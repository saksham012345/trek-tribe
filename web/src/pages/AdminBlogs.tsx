import React, { useEffect, useState } from 'react';
import api from '../config/api';

interface BlogAdminItem {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage?: string;
  status: 'draft' | 'published';
  tags: string[];
  publishedAt?: string;
  updatedAt: string;
}

const emptyForm = {
  title: '',
  excerpt: '',
  content: '',
  coverImage: '',
  tags: '',
  status: 'draft' as 'draft' | 'published'
};

const AdminBlogs: React.FC = () => {
  const [items, setItems] = useState<BlogAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');

  const load = async () => {
    try {
      const res = await api.get('/api/blogs/admin/list');
      setItems(res.data?.data || []);
    } catch (error) {
      console.error('Failed to load admin blogs', error);
      setMessage('Failed to load blogs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        ...form,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean)
      };
      if (editingId) {
        await api.put(`/api/blogs/admin/${editingId}`, payload);
        setMessage('Blog updated');
      } else {
        await api.post('/api/blogs/admin', payload);
        setMessage('Blog created');
      }
      await load();
      resetForm();
    } catch (error: any) {
      setMessage(error?.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const seedDefaults = async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await api.post('/api/blogs/admin/seed');
      setMessage(res.data?.message || 'Default blogs created');
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.error || 'Failed to seed blogs');
    } finally {
      setSaving(false);
    }
  };

  const edit = (item: BlogAdminItem) => {
    setEditingId(item._id);
    setForm({
      title: item.title,
      excerpt: item.excerpt,
      content: item.content || '',
      coverImage: item.coverImage || '',
      tags: (item.tags || []).join(', '),
      status: item.status
    });
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this blog?')) return;
    try {
      await api.delete(`/api/blogs/admin/${id}`);
      setMessage('Blog deleted');
      await load();
    } catch (error) {
      setMessage('Delete failed');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h1 className="text-2xl font-bold text-gray-900">Admin Blog Manager</h1>
          <p className="text-sm text-gray-600 mt-1">Create, publish, and manage blogs from admin panel.</p>
          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={seedDefaults}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Add 5-6 Default Blogs
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              New Blog Form
            </button>
          </div>
          {message && <p className="text-sm mt-3 text-forest-700">{message}</p>}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">{editingId ? 'Edit Blog' : 'Create Blog'}</h2>
            <input
              value={form.title}
              onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
              placeholder="Title"
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
            <textarea
              value={form.excerpt}
              onChange={(e) => setForm((s) => ({ ...s, excerpt: e.target.value }))}
              placeholder="Excerpt"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 h-20"
            />
            <textarea
              value={form.content}
              onChange={(e) => setForm((s) => ({ ...s, content: e.target.value }))}
              placeholder="Content"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 h-40"
            />
            <input
              value={form.coverImage}
              onChange={(e) => setForm((s) => ({ ...s, coverImage: e.target.value }))}
              placeholder="Cover image URL"
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
            <input
              value={form.tags}
              onChange={(e) => setForm((s) => ({ ...s, tags: e.target.value }))}
              placeholder="Tags comma separated"
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
            <select
              value={form.status}
              onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as any }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
            <button
              onClick={save}
              disabled={saving}
              className="w-full px-4 py-2 rounded-lg bg-forest-700 text-white hover:bg-forest-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Update Blog' : 'Create Blog'}
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Existing Blogs</h2>
            {loading ? (
              <p className="text-gray-500">Loading...</p>
            ) : items.length === 0 ? (
              <p className="text-gray-500">No blogs yet.</p>
            ) : (
              <div className="space-y-3 max-h-[560px] overflow-auto pr-1">
                {items.map((item) => (
                  <div key={item._id} className="border border-gray-200 rounded-xl p-3">
                    <p className="font-medium text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{item.slug}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${item.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {item.status}
                      </span>
                      <span className="text-xs text-gray-500">{new Date(item.updatedAt).toLocaleDateString('en-IN')}</span>
                    </div>
                    <div className="flex gap-3 mt-3 text-sm">
                      <button onClick={() => edit(item)} className="text-blue-600 hover:text-blue-800">Edit</button>
                      <button onClick={() => remove(item._id)} className="text-red-600 hover:text-red-800">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminBlogs;
