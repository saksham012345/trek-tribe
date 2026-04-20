import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import api from '../config/api';

interface BlogItem {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage?: string;
  tags: string[];
  publishedAt?: string;
  readTimeMinutes: number;
}

const Blogs: React.FC = () => {
  const [items, setItems] = useState<BlogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/api/blogs?limit=24');
        setItems(res.data?.data || []);
      } catch (error) {
        console.error('Failed to load blogs', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet>
        <title>Travel Blogs | TrekTribe</title>
        <meta name="description" content="Read trekking guides, planning notes, and travel stories from TrekTribe." />
      </Helmet>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">TrekTribe Blogs</h1>
          <p className="text-gray-600 mt-1">Guides, stories, and practical travel insights.</p>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-500">Loading blogs...</div>
        ) : items.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl text-center py-16 text-gray-500">
            No blogs published yet.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((item) => (
              <Link
                key={item._id}
                to={`/blogs/${item.slug}`}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                {item.coverImage && (
                  <img src={item.coverImage} alt={item.title} className="w-full h-44 object-cover" />
                )}
                <div className="p-4">
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h2>
                  <p className="text-sm text-gray-600 mb-3">{item.excerpt}</p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{item.readTimeMinutes} min read</span>
                    <span>{item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('en-IN') : ''}</span>
                  </div>
                  {item.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {item.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-[11px] px-2 py-1 bg-forest-50 text-forest-700 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Blogs;

