'use client';

import { useState, useEffect, ChangeEvent } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BookHeart, Plus, ChevronLeft, ChefHat, Trash2, Star, Loader2, Download } from 'lucide-react';
import dynamic from 'next/dynamic';
import { RecipeBookletPDF } from './RecipePDF';

// NOTE: We do NOT import pdfjs-dist at the top level anymore to prevent Vercel errors.

const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFDownloadLink),
  { ssr: false }
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Home() {
  const [view, setView] = useState<'book' | 'upload' | 'reader'>('book');
  const [recipes, setRecipes] = useState<any[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Mixing ingredients...");

  useEffect(() => {
    fetchRecipes();
  }, []);

  const fetchRecipes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) console.error('Error fetching recipes:', error);
    else setRecipes(data || []);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this recipe from your journal?")) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('recipes').delete().eq('id', id);
      if (error) throw error;
      setRecipes(recipes.filter(r => r.id !== id));
      setView('book'); 
    } catch (err: any) {
      alert("Error deleting: " + err.message);
    } finally {
      setDeleting(false);
    }
  };

  // --- HELPER: Read Standard Image ---
  const imageToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });

  // --- HELPER: Read PDF and Convert Pages to Images ---
  const pdfToImages = async (file: File): Promise<string[]> => {
    // 1. DYNAMICALLY IMPORT PDF.JS (Only loads in the browser)
    const pdfjsLib = await import('pdfjs-dist');
    
    // 2. SET WORKER (Using local version to match)
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const images: string[] = [];

    // Loop through all pages
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 }); 
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      if (context) {
        // FIX: 'as any' prevents TypeScript error about missing properties
        const renderContext = {
          canvasContext: context,
          viewport: viewport
        } as any;

        await page.render(renderContext).promise;
        images.push(canvas.toDataURL('image/jpeg'));
      }
    }
    return images;
  };

  // --- MAIN UPLOAD LOGIC ---
  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setLoading(true);
    setLoadingMessage("Reading files...");
    
    const files = Array.from(e.target.files);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      let userId = user?.id;
      if (!userId) {
        const { data: authData } = await supabase.auth.signInAnonymously();
        userId = authData.user?.id;
      }

      // Process all files (Handle PDF vs Image)
      let allBase64Images: string[] = [];

      for (const file of files) {
        if (file.type === 'application/pdf') {
          setLoadingMessage(`Scanning PDF pages...`);
          const pdfImages = await pdfToImages(file);
          allBase64Images = [...allBase64Images, ...pdfImages];
        } else {
          const img = await imageToBase64(file);
          allBase64Images.push(img);
        }
      }

      setLoadingMessage("AI is reading the recipe...");

      const response = await fetch('/api/digitize', {
        method: 'POST',
        body: JSON.stringify({ images: allBase64Images, userId }),
      });

      const result = await response.json();
      
      if (result.success) {
        await fetchRecipes();
        setView('book'); 
      } else {
        alert("Error: " + result.error);
      }

    } catch (err: any) {
      console.error(err);
      alert("Something went wrong: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const openRecipe = (recipe: any) => {
    setSelectedRecipe(recipe);
    setView('reader');
  };

  return (
    <main className="min-h-screen font-cute text-slate-700">
      
      <div className="fixed inset-0 z-[-1] bg-pink-50" 
           style={{
             backgroundImage: 'radial-gradient(#fbcfe8 2px, transparent 2px)',
             backgroundSize: '24px 24px'
           }}>
      </div>

      <nav className="bg-white/90 backdrop-blur-sm sticky top-4 z-10 mx-4 rounded-full shadow-sm shadow-pink-100 border border-pink-100 mt-4">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-pink-600 font-hand text-2xl font-bold cursor-pointer hover:scale-105 transition-transform" onClick={() => setView('book')}>
            <BookHeart size={28} className="text-pink-400" />
            <span>My Recipe Journal</span>
          </div>
          
          <div className="flex gap-4 items-center">
             {view === 'book' && recipes.length > 0 && (
                <PDFDownloadLink
                  document={<RecipeBookletPDF recipes={recipes} />}
                  fileName="my-cute-cookbook.pdf"
                  className="flex items-center gap-1 text-pink-400 hover:text-pink-600 px-3 py-2 text-sm font-bold transition-colors"
                >
                  {({ loading: pdfLoading }) => (
                    <>
                      <Download size={18} />
                      {pdfLoading ? '...' : 'PDF'}
                    </>
                  )}
                </PDFDownloadLink>
             )}

             {view !== 'book' && (
              <button onClick={() => setView('book')} className="text-sm font-bold text-slate-500 hover:text-pink-600 transition-colors">
                Return Home
              </button>
             )}
             <button 
               onClick={() => setView('upload')} 
               className="flex items-center gap-1 bg-pink-500 text-white px-5 py-2 rounded-full hover:bg-pink-600 transition-all hover:shadow-lg hover:shadow-pink-200 text-sm font-bold active:scale-95">
               <Plus size={18} /> New Page
             </button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-6 pt-8">
        
        {view === 'book' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="text-center mb-10">
              <h1 className="text-4xl font-hand text-slate-800 mb-2 inline-block relative">
                Kitchen Collection
              </h1>
              <p className="text-pink-400 font-bold text-sm uppercase tracking-widest">
                {recipes.length} {recipes.length === 1 ? 'Memory' : 'Memories'} Saved
              </p>
            </div>
            
            {recipes.length === 0 ? (
              <div className="text-center py-20 bg-white/80 backdrop-blur rounded-3xl shadow-sm border-2 border-dashed border-pink-200 mx-auto max-w-md">
                <div className="bg-pink-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ChefHat size={40} className="text-pink-500" />
                </div>
                <h3 className="font-hand text-2xl text-slate-700 mb-2">Your journal is empty!</h3>
                <p className="text-slate-500 mb-6 px-8">Take a picture of Grandma's recipe card or your favorite cookbook page.</p>
                <button onClick={() => setView('upload')} className="bg-pink-500 text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-pink-200 hover:-translate-y-1 transition-all">
                  Add First Recipe
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {recipes.map((r) => (
                  <div 
                    key={r.id} 
                    onClick={() => openRecipe(r)}
                    className="bg-white p-6 pb-12 rounded-xl shadow-sm hover:shadow-xl hover:shadow-pink-200/50 hover:-translate-y-1 transition-all cursor-pointer relative group"
                  >
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-24 h-8 bg-pink-200/80 opacity-90 rotate-[-2deg] shadow-sm backdrop-blur-sm z-10" 
                         style={{ clipPath: 'polygon(0% 0%, 100% 0%, 95% 100%, 5% 100%)' }}>
                    </div>

                    <div className="pl-1 mt-2">
                      <h3 className="font-hand text-2xl font-bold text-slate-800 mb-3 leading-tight line-clamp-2 group-hover:text-pink-600 transition-colors">
                        {r.title || "Untitled Recipe"}
                      </h3>
                      <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">
                        {r.description || "No description available."}
                      </p>
                    </div>
                    
                    <div className="absolute bottom-4 right-6 flex items-center gap-1 text-pink-400 text-xs font-bold group-hover:translate-x-1 transition-transform">
                       <span>OPEN</span> 
                       <ChevronLeft size={14} className="rotate-180" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'upload' && (
          <div className="max-w-xl mx-auto animate-in zoom-in-95 duration-300">
            <button onClick={() => setView('book')} className="mb-6 text-slate-500 hover:text-pink-600 flex items-center gap-1 text-sm font-bold bg-white px-4 py-2 rounded-full shadow-sm w-fit">
              <ChevronLeft size={16} /> Back
            </button>

            <div className="bg-white p-10 rounded-3xl shadow-xl shadow-pink-100 border-4 border-pink-100 text-center relative overflow-hidden">
              <h2 className="text-3xl font-hand text-slate-800 mb-2">Capture a Recipe</h2>
              <p className="text-slate-500 mb-8 font-medium">Upload PDFs, cookbook photos, or handwritten notes.</p>
              
              <label className="block w-full cursor-pointer group">
                <div className="border-3 border-dashed border-pink-200 rounded-2xl p-12 group-hover:bg-pink-50 group-hover:border-pink-400 transition-all bg-slate-50">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:scale-110 transition-transform">
                    <Plus size={32} className="text-pink-400" />
                  </div>
                  <span className="block text-lg font-bold text-slate-700">Click to Select</span>
                  <span className="block text-xs text-pink-500 mt-2 font-bold bg-pink-100 px-2 py-1 rounded-full inline-block">
                    Supports Images & PDF
                  </span>
                </div>
                <input 
                  type="file" 
                  multiple 
                  accept="image/*,.pdf"
                  onChange={handleUpload}
                  disabled={loading}
                  className="hidden"
                />
              </label>

              {loading && (
                <div className="mt-8 flex flex-col items-center">
                  <Loader2 size={32} className="text-pink-400 animate-spin mb-2" />
                  <p className="text-sm text-pink-600 font-bold animate-pulse">{loadingMessage}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'reader' && selectedRecipe && (
          <div className="max-w-3xl mx-auto animate-in slide-in-from-bottom-8 duration-700">
            <div className="flex justify-between items-center mb-6">
              <button onClick={() => setView('book')} className="text-slate-500 hover:text-pink-600 flex items-center gap-1 text-sm font-bold bg-white px-4 py-2 rounded-full shadow-sm hover:shadow-md transition-all">
                <ChevronLeft size={16} /> Back
              </button>
              
              <button 
                onClick={() => handleDelete(selectedRecipe.id)} 
                disabled={deleting}
                className="text-pink-300 hover:text-red-500 flex items-center gap-2 text-sm font-bold hover:bg-red-50 px-4 py-2 rounded-full transition-colors"
              >
                <Trash2 size={16} />
                {deleting ? 'Deleting...' : 'Remove'}
              </button>
            </div>

            <div className="bg-white rounded-3xl shadow-xl shadow-pink-200/50 overflow-hidden relative min-h-[600px] flex flex-col md:flex-row border border-pink-50">
               <div className="hidden md:flex flex-col justify-evenly h-full absolute -left-3 top-0 z-20">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white shadow-inner"></div>
                  ))}
               </div>
               <div className="hidden md:block w-12 bg-pink-50 h-full absolute left-0 top-0 z-0 border-r-2 border-dashed border-pink-200"></div>
               
               <div className="flex-1 p-8 md:pl-20 md:pr-12">
                  <div className="flex items-start gap-3 mb-6 border-b-2 border-pink-100 pb-4">
                    <h1 className="font-hand text-5xl text-slate-800 leading-tight">{selectedRecipe.title}</h1>
                  </div>
                  
                  {selectedRecipe.description && (
                    <div className="bg-yellow-50 p-6 rounded-xl mb-10 text-slate-700 font-hand text-xl leading-relaxed border border-yellow-100 shadow-sm relative rotate-1">
                      {selectedRecipe.description}
                    </div>
                  )}

                  <div className="grid gap-12">
                    <section className="bg-pink-50/50 p-6 rounded-2xl border border-pink-100">
                      <h3 className="font-bold uppercase tracking-widest text-xs text-pink-500 mb-4 flex items-center gap-2">
                        <Star size={14} fill="currentColor" /> Ingredients
                      </h3>
                      <ul className="space-y-3">
                        {selectedRecipe.ingredients?.map((ing: string, i: number) => (
                          <li key={i} className="flex items-start gap-3 text-slate-700 leading-relaxed">
                            <div className="w-5 h-5 rounded-md border-2 border-pink-200 mt-1 shrink-0 flex items-center justify-center">
                            </div>
                            <span className="font-medium">{ing}</span>
                          </li>
                        ))}
                      </ul>
                    </section>

                    <section>
                      <h3 className="font-bold uppercase tracking-widest text-xs text-pink-500 mb-6 flex items-center gap-2">
                         <ChefHat size={16} /> Preparation
                      </h3>
                      <div className="space-y-8">
                        {selectedRecipe.instructions?.map((step: string, i: number) => (
                          <div key={i} className="relative pl-8">
                            <span className="absolute left-0 top-0 font-hand text-3xl text-pink-300 font-bold -mt-2">{i + 1}.</span>
                            <p className="text-slate-700 leading-loose text-lg">{step}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
               </div>
            </div>
          </div>
        )}
      </div>
      
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Patrick+Hand&family=Quicksand:wght@400;500;600;700&display=swap');

        .font-hand { font-family: 'Patrick Hand', cursive; }
        .font-cute { font-family: 'Quicksand', sans-serif; }
      `}</style>
    </main>
  );
}