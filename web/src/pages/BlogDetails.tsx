import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Calendar, Clock, User } from 'lucide-react';
import api from '../config/api';
import { GlassPanel } from '../components/ui/Glass';

interface BlogDetailsData {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage?: string;
  tags: string[];
  publishedAt?: string;
  readTimeMinutes: number;
  authorId?: {
    name: string;
  };
}

const BlogDetails: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<BlogDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!slug) return;
      try {
        const res = await api.get(`/api/blogs/${slug}`);
        setItem(res.data?.data || null);
      } catch (err: any) {
        setError(err?.response?.data?.error || 'Failed to load blog');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  if (loading) {
    return <div className="min-h-screen bg-gray-50 text-center py-16 text-gray-500">Loading blog...</div>;
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <GlassPanel className="rounded-glass p-8 max-w-lg w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Blog not found</h1>
          <p className="text-gray-600 mb-6">{error || 'This blog is not available.'}</p>
          <button
            onClick={() => navigate('/blogs')}
            className="px-4 py-2 rounded-lg bg-forest-700 text-white hover:bg-forest-800 hover:shadow-glow-forest transition-all duration-300 ease-spring"
          >
            Back to Blogs
          </button>
        </GlassPanel>
      </div>
    );
  }

  const paragraphs = item.content
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet>
        <title>{item.title} | TrekTribe Blog</title>
        <meta name="description" content={item.excerpt} />
      </Helmet>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Link to="/blogs" className="inline-flex items-center gap-1.5 text-sm text-forest-700 hover:text-forest-900 mb-4">
          <ArrowLeft size={16} strokeWidth={2.25} /> Back to Blogs
        </Link>

        {item.coverImage && (
          <img src={item.coverImage} alt={item.title} className="w-full h-64 object-cover rounded-glass border border-gray-200 mb-6 shadow-elevation-2" />
        )}

        <h1 className="text-3xl font-bold text-gray-900">{item.title}</h1>
        <p className="text-gray-600 mt-2">{item.excerpt}</p>

        <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-gray-500">
          {item.publishedAt && (
            <span className="flex items-center gap-1"><Calendar size={13} strokeWidth={2} />{new Date(item.publishedAt).toLocaleDateString('en-IN')}</span>
          )}
          <span className="flex items-center gap-1"><Clock size={13} strokeWidth={2} />{item.readTimeMinutes} min read</span>
          {item.authorId?.name && (
            <span className="flex items-center gap-1"><User size={13} strokeWidth={2} />By {item.authorId.name}</span>
          )}
        </div>

        {item.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {item.tags.map((tag) => (
              <span key={tag} className="text-xs px-2 py-1 bg-forest-50 text-forest-700 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        <GlassPanel className="mt-8 rounded-glass p-6 space-y-5">
          {paragraphs.map((paragraph, idx) => (
            <p key={idx} className="text-gray-800 leading-7">
              {paragraph}
            </p>
          ))}
        </GlassPanel>
      </article>
    </div>
  );
};

export default BlogDetails;

