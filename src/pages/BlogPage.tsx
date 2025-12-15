import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { useNavigate } from "react-router-dom";
import { getAllPosts, getFeaturedPosts, BlogPost } from "@/utils/blog-data";
import { Calendar, Clock, ArrowRight, Sparkles } from "lucide-react";
import { useState } from "react";

export function BlogPage() {
  const navigate = useNavigate();
  const allPosts = getAllPosts();
  const featuredPosts = getFeaturedPosts();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Tutorial', 'Product Update', 'Industry News', 'Best Practices'];

  const filteredPosts = selectedCategory === 'All' 
    ? allPosts 
    : allPosts.filter(post => post.category === selectedCategory);

  return (
    <div className="relative bg-black min-h-screen text-white">
      <SEO 
        title="Blog - AI Accounting Insights & Tutorials | Novalare"
        description="Learn about AI accounting automation, DATEV integration, invoice extraction, and bookkeeping best practices. Tips and tutorials for modern accounting firms."
        keywords="accounting blog, AI accounting tutorials, DATEV guides, invoice extraction tips, bank reconciliation best practices, accounting automation"
      />
      
      <Header />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-transparent to-transparent" />
        
        <div className="relative max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-full mb-6">
            <Sparkles className="size-4 text-purple-400" />
            <span className="text-sm text-purple-300" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}>
              Insights & Resources
            </span>
          </div>

          <h1 
            className="text-white mb-6"
            style={{
              fontSize: 'clamp(36px, 5vw, 64px)',
              fontWeight: '800',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '-0.02em',
              lineHeight: '1.1'
            }}
          >
            The Novalare Blog
          </h1>

          <p 
            className="text-gray-300 max-w-2xl mx-auto"
            style={{
              fontSize: 'clamp(16px, 2vw, 20px)',
              fontFamily: "'Manrope', sans-serif",
              fontWeight: '500',
              lineHeight: '1.6'
            }}
          >
            Learn about AI accounting automation, best practices, and industry insights from our team of experts.
          </p>
        </div>
      </section>

      {/* Featured Posts */}
      {featuredPosts.length > 0 && (
        <section className="relative py-12 px-6">
          <div className="max-w-6xl mx-auto">
            <h2 
              className="text-white mb-8"
              style={{
                fontSize: 'clamp(24px, 3vw, 32px)',
                fontWeight: '700',
                fontFamily: "'Outfit', sans-serif",
                letterSpacing: '-0.01em'
              }}
            >
              Featured Articles
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredPosts.map((post) => (
                <FeaturedPostCard key={post.slug} post={post} navigate={navigate} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Category Filter */}
      <section className="relative py-8 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap gap-3 justify-center">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-5 py-2 rounded-full transition-all duration-300 ${
                  selectedCategory === category
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                    : 'bg-gray-900/50 border border-white/10 text-gray-300 hover:border-purple-500/30'
                }`}
                style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* All Posts */}
      <section className="relative py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 
            className="text-white mb-8"
            style={{
              fontSize: 'clamp(24px, 3vw, 32px)',
              fontWeight: '700',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '-0.01em'
            }}
          >
            {selectedCategory === 'All' ? 'All Articles' : selectedCategory}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredPosts.map((post) => (
              <BlogPostCard key={post.slug} post={post} navigate={navigate} />
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="relative py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 rounded-3xl opacity-20 blur-2xl" />
            <div className="relative bg-gradient-to-br from-purple-900/50 to-pink-900/50 border border-purple-500/20 rounded-3xl p-12">
              <h2 
                className="text-white mb-4"
                style={{
                  fontSize: 'clamp(28px, 3.5vw, 42px)',
                  fontWeight: '800',
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: '-0.02em'
                }}
              >
                Stay Updated
              </h2>
              <p 
                className="text-purple-200 mb-8"
                style={{
                  fontSize: '18px',
                  fontFamily: "'Manrope', sans-serif",
                  fontWeight: '500'
                }}
              >
                Get the latest articles and automation tips delivered to your inbox
              </p>
              <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 h-12 px-4 rounded-full bg-white/10 border border-white/20 text-white placeholder:text-gray-400 focus:outline-none focus:border-purple-400"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                />
                <button
                  className="h-12 px-8 bg-white text-purple-600 rounded-full hover:bg-gray-100 transition-all duration-300"
                  style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '700' }}
                >
                  Subscribe
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

// Featured Post Card Component
function FeaturedPostCard({ post, navigate }: { post: BlogPost; navigate: any }) {
  return (
    <div 
      onClick={() => navigate(`/blog/${post.slug}`)}
      className="group cursor-pointer relative"
    >
      <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500" />
      
      <div className="relative bg-gray-900/50 backdrop-blur-sm border border-white/10 rounded-3xl overflow-hidden hover:border-purple-500/30 transition-all duration-300">
        {/* Cover Image */}
        <div className="relative h-48 overflow-hidden">
          <img 
            src={post.coverImage} 
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute top-4 left-4">
            <span 
              className="px-3 py-1 bg-purple-600 text-white rounded-full text-xs"
              style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}
            >
              {post.category}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <h3 
            className="text-white mb-3 group-hover:text-purple-400 transition-colors"
            style={{
              fontSize: '20px',
              fontWeight: '700',
              fontFamily: "'Outfit', sans-serif",
              lineHeight: '1.3'
            }}
          >
            {post.title}
          </h3>

          <p 
            className="text-gray-400 mb-4"
            style={{
              fontSize: '14px',
              fontFamily: "'Manrope', sans-serif",
              fontWeight: '500',
              lineHeight: '1.6'
            }}
          >
            {post.excerpt}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Calendar className="size-4" />
                <span style={{ fontFamily: "'Manrope', sans-serif" }}>
                  {new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="size-4" />
                <span style={{ fontFamily: "'Manrope', sans-serif" }}>{post.readTime}</span>
              </div>
            </div>

            <ArrowRight className="size-5 text-purple-400 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Regular Blog Post Card Component
function BlogPostCard({ post, navigate }: { post: BlogPost; navigate: any }) {
  return (
    <div 
      onClick={() => navigate(`/blog/${post.slug}`)}
      className="group cursor-pointer relative"
    >
      <div className="relative bg-gray-900/30 border border-white/10 rounded-2xl overflow-hidden hover:border-purple-500/30 transition-all duration-300">
        {/* Cover Image */}
        <div className="relative h-40 overflow-hidden">
          <img 
            src={post.coverImage} 
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute top-3 left-3">
            <span 
              className="px-3 py-1 bg-gray-900/90 text-purple-300 rounded-full text-xs border border-purple-500/20"
              style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}
            >
              {post.category}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          <h3 
            className="text-white mb-2 group-hover:text-purple-400 transition-colors"
            style={{
              fontSize: '18px',
              fontWeight: '700',
              fontFamily: "'Outfit', sans-serif",
              lineHeight: '1.3'
            }}
          >
            {post.title}
          </h3>

          <p 
            className="text-gray-400 mb-4 line-clamp-2"
            style={{
              fontSize: '13px',
              fontFamily: "'Manrope', sans-serif",
              fontWeight: '500',
              lineHeight: '1.5'
            }}
          >
            {post.excerpt}
          </p>

          <div className="flex items-center gap-3 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Calendar className="size-3" />
              <span style={{ fontFamily: "'Manrope', sans-serif" }}>
                {new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="size-3" />
              <span style={{ fontFamily: "'Manrope', sans-serif" }}>{post.readTime}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}