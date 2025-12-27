
import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, onValue, push, update, remove } from 'firebase/database';
import { Layout } from './Layout';
import { ImageCard } from './ImageCard';
import { UploadForm } from './UploadForm';
import { PixelArtImage, Comment } from './types';
import { INITIAL_ART, ADMIN_NAME } from './constants';

const FIREBASE_DB_URL = "https://pixelpals-342d3-default-rtdb.asia-southeast1.firebasedatabase.app";
const firebaseConfig = { databaseURL: FIREBASE_DB_URL };

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getDatabase(app);

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<string | null>(() => localStorage.getItem('pixelpals_user'));
  const [currentView, setCurrentView] = useState<'all' | 'hallOfFame' | 'myWorks'>('all');
  const [images, setImages] = useState<PixelArtImage[]>([]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginName, setLoginName] = useState('');

  useEffect(() => {
    const imagesRef = ref(db, 'images');
    const unsubscribe = onValue(imagesRef, (snapshot) => {
      const data = snapshot.val();
      let imageList: PixelArtImage[] = data ? Object.keys(data).map(key => ({ ...data[key], firebaseId: key })) : [];
      INITIAL_ART.forEach(initArt => { if (!imageList.some(img => img.id === initArt.id)) imageList.push(initArt); });
      setImages(imageList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginName.trim()) {
      setCurrentUser(loginName.trim());
      localStorage.setItem('pixelpals_user', loginName.trim());
      setShowLoginModal(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('pixelpals_user');
  };

  const handleUpload = (title: string, creator: string, url: string) => {
    const newArt = { id: Math.random().toString(36).substr(2, 9), url, title, creator, likes: 0, likedBy: [], comments: [], timestamp: Date.now() };
    push(ref(db, 'images'), newArt);
  };

  const handleLike = (id: string) => {
    if (!currentUser) { setShowLoginModal(true); return; }
    const target = images.find(img => img.id === id);
    if (target && !target.likedBy?.includes(currentUser)) {
      const updated = { likes: (target.likes || 0) + 1, likedBy: [...(target.likedBy || []), currentUser] };
      if ((target as any).firebaseId) update(ref(db, `images/${(target as any).firebaseId}`), updated);
    }
  };

  const handleComment = (id: string, text: string, author: string) => {
    const target = images.find(img => img.id === id);
    if (target && (target as any).firebaseId) {
      const newComment = { id: Math.random().toString(36).substr(2, 9), text, author, timestamp: Date.now() };
      update(ref(db, `images/${(target as any).firebaseId}`), { comments: [newComment, ...(target.comments || [])] });
    }
  };

  const handleDelete = (id: string, firebaseId?: string) => {
    if (firebaseId && window.confirm("이 작품을 삭제할까요?")) remove(ref(db, `images/${firebaseId}`));
  };

  const displayedImages = useMemo(() => {
    if (currentView === 'hallOfFame') return images.filter(img => (img.likes || 0) >= 10);
    if (currentView === 'myWorks' && currentUser) return images.filter(img => img.creator === currentUser);
    return images;
  }, [images, currentView, currentUser]);

  return (
    <Layout currentUser={currentUser} currentView={currentView} onLogin={() => setShowLoginModal(true)} onLogout={handleLogout} onSetView={setCurrentView} onCopyLink={() => alert("주소 복사됨!")}>
      {showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form onSubmit={handleLogin} className="bg-white p-8 rounded-[2rem] border-4 border-yellow-400 w-full max-w-sm">
            <h3 className="text-2xl font-bold mb-4 text-center">반가워요! 👋</h3>
            <input autoFocus className="w-full border-2 p-4 rounded-xl mb-4 font-bold text-center" value={loginName} onChange={e => setLoginName(e.target.value)} placeholder="이름을 입력하세요" />
            <button className="bg-yellow-400 w-full py-4 rounded-xl font-bold text-lg hover:bg-yellow-300">입장하기</button>
          </form>
        </div>
      )}
      <UploadForm currentUser={currentUser} onUpload={handleUpload} onLoginPrompt={() => setShowLoginModal(true)} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {displayedImages.map(img => (
          <ImageCard key={img.id} image={img} currentUser={currentUser} onLike={handleLike} onComment={handleComment} onDelete={handleDelete} onLoginPrompt={() => setShowLoginModal(true)} />
        ))}
      </div>
    </Layout>
  );
};
export default App;
