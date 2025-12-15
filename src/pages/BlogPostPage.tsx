import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { useParams, useNavigate } from "react-router-dom";
import { blogPosts } from "@/utils/blog-data";
import { ArrowLeft, Calendar, Clock, User, ArrowRight, Share2, Bookmark } from "lucide-react";
import { toast } from "sonner@2.0.3";

export function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const handleTrialClick = () => {
    toast.info("Coming Soon", {
      description: "Free trial will be available soon. Stay tuned!",
      duration: 3000,
    });
  };

  const post = slug ? blogPosts.find(p => p.slug === slug) : undefined;
  const relatedPosts = post ? blogPosts.filter(p => p.category === post.category && p.slug !== post.slug).slice(0, 3) : [];

  if (!post) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-white text-4xl mb-4">Post Not Found</h1>
          <Button onClick={() => navigate('/blog')}>
            Back to Blog
          </Button>
        </div>
      </div>
    );
  }

  const shareUrl = window.location.href;
  const shareTitle = post.title;

  return (
    <div className="relative bg-black min-h-screen text-white">
      <SEO 
        title={`${post.title} | Novalare Blog`}
        description={post.excerpt}
        keywords={post.tags.join(', ')}
        ogImage={post.coverImage}
        ogUrl={shareUrl}
      />
      
      <Header />

      {/* Hero Section */}
      <section className="relative pt-32 pb-12 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Back button */}
          <button
            onClick={() => navigate('/blog')}
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 group transition-colors"
            style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '500' }}
          >
            <ArrowLeft className="size-4 group-hover:-translate-x-1 transition-transform" />
            Back to Blog
          </button>

          {/* Category badge */}
          <div className="mb-6">
            <span 
              className="px-4 py-2 bg-purple-600/20 border border-purple-500/30 text-purple-300 rounded-full text-sm"
              style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '600' }}
            >
              {post.category}
            </span>
          </div>

          {/* Title */}
          <h1 
            className="text-white mb-6"
            style={{
              fontSize: 'clamp(32px, 5vw, 56px)',
              fontWeight: '800',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '-0.02em',
              lineHeight: '1.1'
            }}
          >
            {post.title}
          </h1>

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-6 mb-8">
            <div className="flex items-center gap-3">
              <Avatar className="size-12 border-2 border-purple-500/30">
                <AvatarImage src={post.author.avatar} alt={post.author.name} />
                <AvatarFallback>{post.author.name[0]}</AvatarFallback>
              </Avatar>
              <div>
                <div 
                  className="text-white"
                  style={{
                    fontSize: '15px',
                    fontWeight: '600',
                    fontFamily: "'Outfit', sans-serif"
                  }}
                >
                  {post.author.name}
                </div>
                <div 
                  className="text-gray-400"
                  style={{
                    fontSize: '13px',
                    fontFamily: "'Manrope', sans-serif"
                  }}
                >
                  {post.author.role}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-gray-400">
              <div className="flex items-center gap-2">
                <Calendar className="size-4" />
                <span style={{ fontSize: '14px', fontFamily: "'Manrope', sans-serif" }}>
                  {new Date(post.publishedAt).toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="size-4" />
                <span style={{ fontSize: '14px', fontFamily: "'Manrope', sans-serif" }}>
                  {post.readTime}
                </span>
              </div>
            </div>
          </div>

          {/* Share buttons */}
          <div className="flex items-center gap-3 pb-8 border-b border-white/10">
            <span 
              className="text-gray-400 flex items-center gap-2"
              style={{ fontSize: '14px', fontFamily: "'Manrope', sans-serif", fontWeight: '500' }}
            >
              <Share2 className="size-4" />
              Share:
            </span>
            <button
              onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(shareUrl)}`, '_blank')}
              className="p-2 bg-gray-900/50 border border-white/10 rounded-lg hover:border-blue-500/50 hover:bg-blue-500/10 transition-all"
            >
              <Twitter className="size-4 text-gray-400" />
            </button>
            <button
              onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, '_blank')}
              className="p-2 bg-gray-900/50 border border-white/10 rounded-lg hover:border-blue-600/50 hover:bg-blue-600/10 transition-all"
            >
              <Linkedin className="size-4 text-gray-400" />
            </button>
            <button
              onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank')}
              className="p-2 bg-gray-900/50 border border-white/10 rounded-lg hover:border-blue-700/50 hover:bg-blue-700/10 transition-all"
            >
              <Facebook className="size-4 text-gray-400" />
            </button>
          </div>
        </div>
      </section>

      {/* Cover Image */}
      <section className="relative px-6 mb-12">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden">
            <img 
              src={post.coverImage} 
              alt={post.title}
              className="w-full h-auto"
            />
          </div>
        </div>
      </section>

      {/* Article Content */}
      <article className="relative px-6 pb-12">
        <div className="max-w-4xl mx-auto">
          <div 
            className="blog-content"
            style={{
              color: '#d1d5db',
              fontFamily: "'Manrope', sans-serif",
              fontSize: '17px',
              lineHeight: '1.8'
            }}
          >
            <ReactMarkdown
              components={{
                h1: ({node, ...props}) => (
                  <h1 
                    {...props} 
                    style={{
                      color: 'white',
                      fontSize: 'clamp(32px, 4vw, 48px)',
                      fontWeight: '800',
                      fontFamily: "'Outfit', sans-serif",
                      marginTop: '48px',
                      marginBottom: '24px',
                      lineHeight: '1.2',
                      letterSpacing: '-0.02em'
                    }}
                  />
                ),
                h2: ({node, ...props}) => (
                  <h2 
                    {...props} 
                    style={{
                      color: 'white',
                      fontSize: 'clamp(24px, 3vw, 32px)',
                      fontWeight: '700',
                      fontFamily: "'Outfit', sans-serif",
                      marginTop: '48px',
                      marginBottom: '20px',
                      paddingBottom: '16px',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                      lineHeight: '1.3',
                      letterSpacing: '-0.01em'
                    }}
                  />
                ),
                h3: ({node, ...props}) => (
                  <h3 
                    {...props} 
                    style={{
                      color: 'white',
                      fontSize: 'clamp(18px, 2.5vw, 24px)',
                      fontWeight: '600',
                      fontFamily: "'Outfit', sans-serif",
                      marginTop: '32px',
                      marginBottom: '16px',
                      lineHeight: '1.4'
                    }}
                  />
                ),
                p: ({node, ...props}) => (
                  <p 
                    {...props} 
                    style={{
                      color: '#d1d5db',
                      marginBottom: '24px',
                      lineHeight: '1.8'
                    }}
                  />
                ),
                ul: ({node, ...props}) => (
                  <ul 
                    {...props} 
                    style={{
                      color: '#d1d5db',
                      marginTop: '20px',
                      marginBottom: '20px',
                      paddingLeft: '24px',
                      listStyleType: 'disc'
                    }}
                  />
                ),
                ol: ({node, ...props}) => (
                  <ol 
                    {...props} 
                    style={{
                      color: '#d1d5db',
                      marginTop: '20px',
                      marginBottom: '20px',
                      paddingLeft: '24px',
                      listStyleType: 'decimal'
                    }}
                  />
                ),
                li: ({node, ...props}) => (
                  <li 
                    {...props} 
                    style={{
                      color: '#d1d5db',
                      marginBottom: '8px',
                      lineHeight: '1.7'
                    }}
                  />
                ),
                strong: ({node, ...props}) => (
                  <strong 
                    {...props} 
                    style={{
                      color: 'white',
                      fontWeight: '600'
                    }}
                  />
                ),
                a: ({node, ...props}) => (
                  <a 
                    {...props} 
                    style={{
                      color: '#c084fc',
                      textDecoration: 'none'
                    }}
                  />
                ),
                code: ({node, ...props}) => (
                  <code 
                    {...props} 
                    style={{
                      color: '#c084fc',
                      backgroundColor: 'rgba(168, 85, 247, 0.1)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '0.9em'
                    }}
                  />
                ),
              }}
            >
              {post.content}
            </ReactMarkdown>
          </div>

          {/* Tags */}
          <div className="mt-12 pt-8 border-t border-white/10">
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-4 py-2 bg-gray-900/50 border border-white/10 text-gray-300 rounded-full text-sm hover:border-purple-500/30 transition-colors cursor-pointer"
                  style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '500' }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </article>

      {/* CTA Section */}
      <section className="relative py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 rounded-3xl opacity-20 blur-2xl" />
            <div className="relative bg-gradient-to-br from-purple-900/50 to-pink-900/50 border border-purple-500/20 rounded-3xl p-10 text-center">
              <h2 
                className="text-white mb-4"
                style={{
                  fontSize: 'clamp(24px, 3vw, 36px)',
                  fontWeight: '800',
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: '-0.02em'
                }}
              >
                Ready to Automate Your Accounting?
              </h2>
              <p 
                className="text-purple-200 mb-6"
                style={{
                  fontSize: '16px',
                  fontFamily: "'Manrope', sans-serif",
                  fontWeight: '500'
                }}
              >
                Start your 14-day free trial and see why hundreds of firms trust Novalare
              </p>
              <Button
                onClick={handleTrialClick}
                className="h-12 px-8 bg-white text-purple-600 hover:bg-gray-100 border-0 shadow-lg"
                style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '700' }}
              >
                Start Free Trial
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <section className="relative py-12 px-6 bg-gradient-to-b from-transparent via-purple-900/10 to-transparent">
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
              Related Articles
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedPosts.map((relatedPost) => (
                <div 
                  key={relatedPost.slug}
                  onClick={() => navigate(`/blog/${relatedPost.slug}`)}
                  className="group cursor-pointer relative"
                >
                  <div className="relative bg-gray-900/30 border border-white/10 rounded-2xl overflow-hidden hover:border-purple-500/30 transition-all duration-300">
                    <div className="relative h-40 overflow-hidden">
                      <img 
                        src={relatedPost.coverImage} 
                        alt={relatedPost.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    <div className="p-5">
                      <h3 
                        className="text-white mb-2 group-hover:text-purple-400 transition-colors line-clamp-2"
                        style={{
                          fontSize: '16px',
                          fontWeight: '700',
                          fontFamily: "'Outfit', sans-serif",
                          lineHeight: '1.3'
                        }}
                      >
                        {relatedPost.title}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="size-3" />
                        <span style={{ fontFamily: "'Manrope', sans-serif" }}>{relatedPost.readTime}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}