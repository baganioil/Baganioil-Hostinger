(function () {
  'use strict';

  var PROJECT_ID = 'c7mgn6k7';
  var DATASET = 'production';
  var API_VER = '2024-01-01';

  // ── Preview mode detection ─────────────────────────────────────────────────
  var _params = new URLSearchParams(window.location.search);
  var IS_PREVIEW = _params.get('preview') === 'true';
  var PREVIEW_TOKEN = _params.get('token') || '';

  if (IS_PREVIEW) {
    document.addEventListener('DOMContentLoaded', function () {
      var banner = document.createElement('div');
      banner.id = 'preview-banner';
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#FFC107;color:#121212;text-align:center;padding:6px 16px;font-size:13px;font-weight:700;letter-spacing:.5px;';
      banner.textContent = '⚠ PREVIEW MODE — Showing draft content, not published';
      document.body.prepend(banner);
      document.body.style.paddingTop = (parseInt(document.body.style.paddingTop || '0') + 34) + 'px';
    });
  }

  function sanityFetch(query) {
    function parseResult(r) {
      if (!r.ok) throw new Error('sanity fetch failed: ' + r.status);
      return r.json().then(function (d) { return d.result; });
    }

    var url = 'https://baganioil-hostinger.onrender.com/sanity-query?query=' + encodeURIComponent(query);
    if (IS_PREVIEW) {
      url += '&preview=true';
      if (PREVIEW_TOKEN) url += '&token=' + encodeURIComponent(PREVIEW_TOKEN);
    }

    return fetch(url, { cache: 'no-store' }).then(parseResult);
  }

  function reInitWow() {
    if (typeof WOW !== 'undefined') new WOW({ offset: 0 }).init();
  }

  // ── NEWS LISTING ────────────────────────────────────────────────────────────
  function formatDate(raw) {
    if (!raw) return '';
    var d = new Date(raw);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function formatDateParts(raw) {
    if (!raw) return null;
    var d = new Date(raw);
    return {
      day: String(d.getDate()).padStart(2, '0'),
      month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
    };
  }

  function articleHref(a) {
    return a.isExternal ? a.url : '/news/article/?s=' + encodeURIComponent(a.slug);
  }
  function articleTarget(a) {
    return a.isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
  }
  function articleTag(a) {
    return a.isExternal ? (a.source || 'Oil & Gas') : ((a.tags && a.tags[0]) ? a.tags[0] : 'News');
  }

  function escHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function decodeHtmlEntities(str) {
    if (!str) return '';
    var ta = document.createElement('textarea');
    ta.innerHTML = str;
    return ta.value;
  }

  function openExtNewsModal(data) {
    var overlay = document.getElementById('extNewsModal');
    var body = document.getElementById('extNewsModalBody');
    if (!overlay || !body) return;

    var date = formatDate(data.date);
    var title = escHtml(data.title || 'Untitled');
    var source = escHtml(data.source || 'News');
    var excerpt = escHtml(decodeHtmlEntities(data.excerpt || ''));
    var excerptHtml = excerpt
      ? '<div class="ext-news-modal-excerpt">' + excerpt.replace(/\n/g, '<br>') + '</div>'
      : '';
    var heroImage = escHtml(data.image || '/images/post-1.jpg');
    var videoEmbed = data.videoEmbed || '';

    var heroHtml = '';
    if (videoEmbed) {
      heroHtml = '<div class="ext-news-modal-hero ext-news-modal-hero--video">' +
        '<iframe class="ext-news-modal-video" src="' + escHtml(videoEmbed) + '" allowfullscreen loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>' +
        '<div class="ext-news-modal-hero-meta ext-news-modal-hero-meta--video">' +
          '<span class="ext-news-modal-source">' + source + '</span>' +
          (date ? '<span class="ext-news-modal-date"><i class="fa-regular fa-calendar"></i> ' + date + '</span>' : '') +
        '</div>' +
      '</div>';
    } else {
      heroHtml = '<div class="ext-news-modal-hero">' +
        '<img class="ext-news-modal-img" src="' + heroImage + '" alt="' + title + '" loading="lazy" onerror="this.onerror=null;this.src=\'/images/post-1.jpg\';">' +
        '<div class="ext-news-modal-hero-overlay"></div>' +
        '<div class="ext-news-modal-hero-meta">' +
          '<span class="ext-news-modal-source">' + source + '</span>' +
          (date ? '<span class="ext-news-modal-date"><i class="fa-regular fa-calendar"></i> ' + date + '</span>' : '') +
        '</div>' +
      '</div>';
    }

    body.innerHTML = heroHtml +
      '<div class="ext-news-modal-content">' +
        '<h3 class="ext-news-modal-title">' + title + '</h3>' +
        '<div class="ext-news-modal-divider"></div>' +
        excerptHtml +
      '</div>';

    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeExtNewsModal() {
    var overlay = document.getElementById('extNewsModal');
    var body = document.getElementById('extNewsModalBody');
    if (!overlay) return;

    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    if (body) {
      // Drop iframe to stop playback immediately on close.
      body.innerHTML = '';
    }
  }

  var _extModalEventsBound = false;

  var EXTERNAL_NEWS_CACHE_KEY = 'bagani-external-news-cache-v9';
  var EXTERNAL_NEWS_CACHE_TTL_MS = 30 * 60 * 1000;

  function readExternalNewsCache() {
    try {
      var raw = localStorage.getItem(EXTERNAL_NEWS_CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.items) || !parsed.savedAt) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function writeExternalNewsCache(items) {
    try {
      localStorage.setItem(EXTERNAL_NEWS_CACHE_KEY, JSON.stringify({
        savedAt: Date.now(),
        items: items || []
      }));
    } catch (e) {
      // Ignore storage errors in private mode / quota issues.
    }
  }

  function fetchExternalNewsLive(options) {
    options = options || {};
    var forceRefresh = !!options.forceRefresh;
    var cached = readExternalNewsCache();

    if (!forceRefresh && cached && (Date.now() - cached.savedAt) < EXTERNAL_NEWS_CACHE_TTL_MS) {
      return Promise.resolve(cached.items);
    }

    var endpoint = 'https://baganioil-hostinger.onrender.com/external-news' + (forceRefresh ? ('?refresh=' + Date.now()) : '');

    return fetch(endpoint, { cache: forceRefresh ? 'no-store' : 'default' })
      .then(function (r) {
        if (r.status === 429) throw new Error('rate-limited');
        if (!r.ok) throw new Error('external-news fetch failed');
        return r.json();
      })
      .then(function (payload) {
        var items = (payload && payload.items) ? payload.items : [];
        if (items.length) writeExternalNewsCache(items);
        return items;
      })
      .catch(function () {
        var fallbackCache = readExternalNewsCache();
        if (fallbackCache && Array.isArray(fallbackCache.items) && fallbackCache.items.length) {
          return fallbackCache.items;
        }
        return window.externalNews || [];
      });
  }

  var BAGANI_UPDATES_PAGE_SIZE = 9;
  var EXTERNAL_NEWS_PAGE_SIZE = 6;
  var _newsPaginationState = { baganiPage: 1, externalPage: 1, baganiFilter: 'all' };
  var _newsDataCache = null;

  function normalizeBaganiCategory(article) {
    var raw = (article && (article.category || (article.tags && article.tags[0]))) || '';
    var key = String(raw).trim().toLowerCase();
    if (key === 'announcement' || key === 'announcements') return 'Announcement';
    if (key === 'event' || key === 'events') return 'Event';
    if (key === 'article' || key === 'articles' || key === 'blog' || key === 'blogs') return 'Article';
    if (key === 'update' || key === 'updates') return 'Updates';
    if (key === 'news') return 'News';
    return 'News';
  }

  function baganiCategoryClass(category) {
    var c = normalizeBaganiCategory({ category: category });
    return 'bagani-type-' + c.toLowerCase();
  }

  function clampPage(page, total) {
    if (total < 1) return 1;
    if (page < 1) return 1;
    if (page > total) return total;
    return page;
  }

  function renderPager(target, currentPage, totalPages) {
    if (totalPages <= 1) return '';

    var prevDisabled = currentPage <= 1 ? ' disabled' : '';
    var nextDisabled = currentPage >= totalPages ? ' disabled' : '';
    var html = '<div class="news-pagination" data-target="' + target + '">';
    html += '<button class="news-page-btn" data-news-page-target="' + target + '" data-news-page="' + (currentPage - 1) + '"' + prevDisabled + '>Prev</button>';

    for (var i = 1; i <= totalPages; i++) {
      var active = i === currentPage ? ' is-active' : '';
      html += '<button class="news-page-btn' + active + '" data-news-page-target="' + target + '" data-news-page="' + i + '">' + i + '</button>';
    }

    html += '<button class="news-page-btn" data-news-page-target="' + target + '" data-news-page="' + (currentPage + 1) + '"' + nextDisabled + '>Next</button>';
    html += '</div>';
    return html;
  }

  function bindNewsControls() {
    var refreshBtn = document.getElementById('refreshExternalNewsBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        if (refreshBtn.disabled) return;
        refreshBtn.disabled = true;
        refreshBtn.classList.add('is-loading');
        var icon = refreshBtn.querySelector('i');
        if (icon) icon.classList.add('fa-spin');
        var label = refreshBtn.querySelector('.refresh-news-label');
        if (label) label.textContent = 'Refreshing...';
        _newsPaginationState.externalPage = 1;

        var _refreshStart = Date.now();
        var MIN_LOADING_MS = 800;

        fetchExternalNewsLive({ forceRefresh: true })
          .then(function (items) {
            var elapsed = Date.now() - _refreshStart;
            var delay = Math.max(0, MIN_LOADING_MS - elapsed);
            setTimeout(function () {
              if (_newsDataCache) {
                _newsDataCache.external = items;
                renderNewsGrid(_newsDataCache.bagani, _newsDataCache.external);
              } else {
                initNews(false);
              }
            }, delay);
          })
          .catch(function () {
            setTimeout(function () {
              var btn = document.getElementById('refreshExternalNewsBtn');
              if (btn) {
                btn.disabled = false;
                btn.classList.remove('is-loading');
                var ico = btn.querySelector('i');
                if (ico) ico.classList.remove('fa-spin');
                var lbl = btn.querySelector('.refresh-news-label');
                if (lbl) lbl.textContent = 'Refresh News';
              }
            }, Math.max(0, MIN_LOADING_MS - (Date.now() - _refreshStart)));
          });
      });
    }

    var pageButtons = document.querySelectorAll('[data-news-page-target][data-news-page]');
    pageButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = btn.getAttribute('data-news-page-target');
        var page = parseInt(btn.getAttribute('data-news-page'), 10);
        if (!target || isNaN(page)) return;
        if (btn.hasAttribute('disabled')) return;

        var externalSectionTop = null;
        if (target === 'external') {
          var externalSection = document.querySelector('.mag-industry-section');
          if (externalSection) {
            externalSectionTop = externalSection.getBoundingClientRect().top + window.pageYOffset;
          }
        }

        if (target === 'bagani') _newsPaginationState.baganiPage = page;
        if (target === 'external') _newsPaginationState.externalPage = page;

        if (_newsDataCache) {
          renderNewsGrid(_newsDataCache.bagani, _newsDataCache.external);

          if (target === 'external') {
            requestAnimationFrame(function () {
              var intro = document.querySelector('.mag-industry-section .news-section-intro');
              if (intro) {
                var y = intro.getBoundingClientRect().top + window.pageYOffset - 12;
                window.scrollTo({ top: Math.max(0, y), behavior: 'auto' });
              } else if (externalSectionTop !== null) {
                window.scrollTo({ top: Math.max(0, externalSectionTop - 12), behavior: 'auto' });
              }
            });
          }
        }
      });
    });

    var filterButtons = document.querySelectorAll('[data-news-filter]');
    filterButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var filter = btn.getAttribute('data-news-filter') || 'all';
        _newsPaginationState.baganiFilter = filter;
        _newsPaginationState.baganiPage = 1;
        if (_newsDataCache) renderNewsGrid(_newsDataCache.bagani, _newsDataCache.external);
      });
    });

    var newsGrid = document.getElementById('sanity-news-grid');
    if (newsGrid) {
      newsGrid.addEventListener('click', function (e) {
        var card = e.target.closest('.news-feed-item[data-ext-title]');
        if (!card) return;
        openExtNewsModal({
          title: card.getAttribute('data-ext-title'),
          source: card.getAttribute('data-ext-source'),
          date: card.getAttribute('data-ext-date'),
          image: card.getAttribute('data-ext-image'),
          excerpt: card.getAttribute('data-ext-excerpt'),
          videoEmbed: card.getAttribute('data-ext-video') || null,
        });
      });

      newsGrid.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var card = e.target.closest('.news-feed-item[data-ext-title]');
        if (!card) return;
        e.preventDefault();
        openExtNewsModal({
          title: card.getAttribute('data-ext-title'),
          source: card.getAttribute('data-ext-source'),
          date: card.getAttribute('data-ext-date'),
          image: card.getAttribute('data-ext-image'),
          excerpt: card.getAttribute('data-ext-excerpt'),
          videoEmbed: card.getAttribute('data-ext-video') || null,
        });
      });
    }

    if (!_extModalEventsBound) {
      _extModalEventsBound = true;

      var modalClose = document.getElementById('extNewsModalClose');
      if (modalClose) modalClose.addEventListener('click', closeExtNewsModal);

      var modalOverlay = document.getElementById('extNewsModal');
      if (modalOverlay) {
        modalOverlay.addEventListener('click', function (e) {
          if (e.target === modalOverlay) closeExtNewsModal();
        });
      }

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeExtNewsModal();
      });
    }
  }

  function renderNewsGrid(baganiArticles, external) {
    var grid = document.getElementById('sanity-news-grid');
    if (!grid) return;

    var html = '';

    // ── BAGANI UPDATES ────────────────────────────────────────────────────
    html += '<div class="col-12">' +
      '<div class="news-section-intro">' +
        '<div class="news-section-eyebrow wow fadeInDown" data-wow-duration="0.6s">From Bagani</div>' +
        '<h2 class="news-section-heading wow fadeInDown" data-wow-duration="0.7s" data-wow-delay="0.1s">Bagani <span>Updates</span></h2>' +
        '<p class="news-section-desc wow fadeInUp" data-wow-duration="0.7s" data-wow-delay="0.2s">Events, articles, announcements, and brand news in one clean feed.</p>' +
      '</div>' +
    '</div>';

    if (!baganiArticles.length) {
      var emptyCategoryOrder = ['Announcement', 'Article', 'Event', 'Updates', 'News'];
      var emptyFilter = _newsPaginationState.baganiFilter || 'all';
      var emptyChipsHtml = '<button class="bagani-filter-chip' + (emptyFilter === 'all' ? ' is-active' : '') + '" data-news-filter="all">All <span>0</span></button>';
      emptyChipsHtml += emptyCategoryOrder.map(function (cat) {
        var key = cat.toLowerCase();
        return '<button class="bagani-filter-chip' + (emptyFilter === key ? ' is-active' : '') + '" data-news-filter="' + key + '">' + cat + ' <span>0</span></button>';
      }).join('');

      html += '<div class="col-12"><div class="bagani-filter-wrap wow fadeInUp" data-wow-duration="0.6s" data-wow-delay="0.15s">' + emptyChipsHtml + '</div></div>';
      html += '<div class="col-12 text-center py-4">' +
        '<p style="color:#888">No updates published yet.</p>' +
      '</div>';
    } else {
      var categoryOrder = ['Announcement', 'Article', 'Event', 'Updates', 'News'];
      var categoryCounts = { Announcement: 0, Event: 0, Article: 0, Updates: 0, News: 0 };
      baganiArticles.forEach(function (a) {
        var type = normalizeBaganiCategory(a);
        categoryCounts[type] = (categoryCounts[type] || 0) + 1;
      });

      var activeFilter = _newsPaginationState.baganiFilter || 'all';
      var filtered = baganiArticles.filter(function (a) {
        if (activeFilter === 'all') return true;
        return normalizeBaganiCategory(a).toLowerCase() === activeFilter;
      });

      var chipsHtml = '<button class="bagani-filter-chip' + (activeFilter === 'all' ? ' is-active' : '') + '" data-news-filter="all">All <span>' + baganiArticles.length + '</span></button>';
      chipsHtml += categoryOrder.map(function (cat) {
        var key = cat.toLowerCase();
        return '<button class="bagani-filter-chip' + (activeFilter === key ? ' is-active' : '') + '" data-news-filter="' + key + '">' + cat + ' <span>' + (categoryCounts[cat] || 0) + '</span></button>';
      }).join('');

      html += '<div class="col-12"><div class="bagani-filter-wrap wow fadeInUp" data-wow-duration="0.6s" data-wow-delay="0.15s">' + chipsHtml + '</div></div>';

      var baganiTotalPages = Math.ceil(filtered.length / BAGANI_UPDATES_PAGE_SIZE) || 1;
      _newsPaginationState.baganiPage = clampPage(_newsPaginationState.baganiPage, baganiTotalPages);
      var baganiStart = (_newsPaginationState.baganiPage - 1) * BAGANI_UPDATES_PAGE_SIZE;
      var baganiPaged = filtered.slice(baganiStart, baganiStart + BAGANI_UPDATES_PAGE_SIZE);

      if (!baganiPaged.length) {
        html += '<div class="col-12 text-center py-4"><p style="color:#888">No updates in this category yet.</p></div>';
      } else {
        var baganiCardsHtml = baganiPaged.map(function (a, bi) {
          var href = '/news/article/?s=' + encodeURIComponent(a.slug);
          var type = normalizeBaganiCategory(a);
          var title = escHtml(a.title || 'Untitled');
          var img = escHtml(a.image || '/images/post-1.jpg');
          var excerpt = a.excerpt ? escHtml(decodeHtmlEntities(a.excerpt)) : '';
          var date = formatDate(a.date);
          var bDelay = (bi * 0.08).toFixed(2);

          return '<div class="col-xl-4 col-md-6 col-12 wow fadeInUp" data-wow-duration="0.7s" data-wow-delay="' + bDelay + 's">' +
            '<article class="news-feed-item news-feed-item--stack news-feed-item--bagani">' +
              '<a class="news-feed-thumb news-feed-thumb--stack" href="' + href + '">' +
                '<img src="' + img + '" alt="' + title + '" loading="lazy" onerror="this.onerror=null;this.src=\'/images/post-1.jpg\';">' +
              '</a>' +
              '<div class="news-feed-body news-feed-body--stack">' +
                '<div class="news-feed-meta">' +
                  '<span class="news-feed-source">' + type + '</span>' +
                  (date ? '<span class="news-feed-date"><i class="fa-regular fa-calendar"></i> ' + date + '</span>' : '') +
                '</div>' +
                '<h4 class="news-feed-title"><a href="' + href + '">' + title + '</a></h4>' +
                (excerpt ? '<p class="news-feed-excerpt">' + excerpt + '</p>' : '') +
                '<a class="news-feed-link" href="' + href + '">Open Article <i class="fa-solid fa-arrow-up-right-from-square"></i></a>' +
              '</div>' +
            '</article>' +
          '</div>';
        }).join('');

        html += '<div class="col-12"><div class="row g-4">' + baganiCardsHtml + '</div>' + renderPager('bagani', _newsPaginationState.baganiPage, baganiTotalPages) + '</div>';
      }
    }

    if (external.length) {
      var externalTotalPages = Math.ceil(external.length / EXTERNAL_NEWS_PAGE_SIZE);
      _newsPaginationState.externalPage = clampPage(_newsPaginationState.externalPage, externalTotalPages);
      var extStart = (_newsPaginationState.externalPage - 1) * EXTERNAL_NEWS_PAGE_SIZE;
      var externalPagedItems = external.slice(extStart, extStart + EXTERNAL_NEWS_PAGE_SIZE);

      var industryHtml = externalPagedItems.map(function (a, ei) {
        var date = formatDate(a.date);
        var image = escHtml(a.image || '/images/post-1.jpg');
        var title = escHtml(a.title || 'Untitled');
        var excerpt = escHtml(decodeHtmlEntities(a.excerpt || ''));
        var source = escHtml(a.source || 'News');
        var rawDate = escHtml(a.date || '');
        var videoEmbed = a.videoEmbed ? escHtml(a.videoEmbed) : '';
        var eDelay = (ei * 0.08).toFixed(2);

        return '<div class="col-xl-4 col-md-6 col-12 wow fadeInUp" data-wow-duration="0.7s" data-wow-delay="' + eDelay + 's">' +
          '<article class="news-feed-item news-feed-item--stack has-image" role="button" tabindex="0"' +
            ' data-ext-title="' + title + '"' +
            ' data-ext-source="' + source + '"' +
            ' data-ext-date="' + rawDate + '"' +
            ' data-ext-image="' + image + '"' +
            ' data-ext-excerpt="' + excerpt + '"' +
            (videoEmbed ? ' data-ext-video="' + videoEmbed + '"' : '') +
          '>' +
            '<div class="news-feed-thumb news-feed-thumb--stack">' +
              '<img src="' + image + '" alt="' + title + '" loading="lazy" onerror="this.onerror=null;this.src=\'/images/post-1.jpg\';">' +
              (videoEmbed ? '<span class="news-feed-play" aria-hidden="true"><i class="fa-solid fa-play"></i></span>' : '') +
            '</div>' +
            '<div class="news-feed-body news-feed-body--stack">' +
              '<div class="news-feed-meta">' +
                '<span class="news-feed-source">' + (a.source || 'News') + '</span>' +
                (date ? '<span class="news-feed-date"><i class="fa-regular fa-calendar"></i> ' + date + '</span>' : '') +
              '</div>' +
              '<h4 class="news-feed-title">' + title + '</h4>' +
              (excerpt ? '<p class="news-feed-excerpt">' + excerpt + '</p>' : '') +
              '<span class="news-feed-link">Open Article <i class="fa-solid fa-arrow-up-right-from-square"></i></span>' +
            '</div>' +
          '</article>' +
        '</div>';
      }).join('');

      html += '<div class="col-12 mag-industry-section">' +
        '<div class="news-section-intro">' +
          '<div class="news-section-eyebrow wow fadeInDown" data-wow-duration="0.6s">From Philippine Sources</div>' +
          '<h2 class="news-section-heading wow fadeInDown" data-wow-duration="0.7s" data-wow-delay="0.1s">Oil Industry <span>News</span></h2>' +
          '<p class="news-section-desc wow fadeInUp" data-wow-duration="0.7s" data-wow-delay="0.2s">Latest oil &amp; energy updates from GMA News, Philstar, and more.</p>' +
          '<button type="button" class="news-refresh-btn wow fadeInUp" data-wow-duration="0.6s" data-wow-delay="0.3s" id="refreshExternalNewsBtn"><i class="fa-solid fa-rotate-right"></i> <span class="refresh-news-label">Refresh News</span></button>' +
          '<div class="news-section-rule wow fadeInUp" data-wow-duration="0.8s" data-wow-delay="0.35s"></div>' +
        '</div>' +
        '<div class="row g-4">' + industryHtml + '</div>' +
        renderPager('external', _newsPaginationState.externalPage, externalTotalPages) +
      '</div>';
    }

    grid.innerHTML = html;
    bindNewsControls();
    reInitWow();
  }

  function initNews(forceExternalRefresh) {
    var grid = document.getElementById('sanity-news-grid');
    if (!grid) return Promise.resolve();

    if (_newsDataCache && !forceExternalRefresh) {
      renderNewsGrid(_newsDataCache.bagani, _newsDataCache.external);
      return Promise.resolve();
    }

    grid.innerHTML = '<div class="col-12 text-center py-5"><p style="color:#aaa">Loading articles...</p></div>';

    Promise.all([
      sanityFetch('*[_type == "article"] | order(date desc) { "slug": slug.current, title, date, category, "image": image.asset->url, excerpt, tags }'),
      fetchExternalNewsLive({ forceRefresh: !!forceExternalRefresh })
    ])
      .then(function (results) {
        var sanityArticles = results[0];
        var liveExternal = results[1];
        var baganiArticles = sanityArticles || [];
        var external = liveExternal && liveExternal.length ? liveExternal : (window.externalNews || []);
        _newsDataCache = { bagani: baganiArticles, external: external };
        renderNewsGrid(baganiArticles, external);
      })
      .catch(function () {
        grid.innerHTML = '<div class="col-12 text-center py-5"><p style="color:#888">Could not load articles.</p></div>';
      });
  }

  // ── NEWS ARTICLE (single, client-side) ─────────────────────────────────────
  function initNewsArticle() {
    var container = document.getElementById('sanity-article');
    if (!container) return;

    var slug = new URLSearchParams(window.location.search).get('s');
    if (!slug) {
      container.innerHTML = '<p style="text-align:center;padding:60px 0;color:#888">Article not found.</p>';
      return;
    }

    container.innerHTML = '<div style="text-align:center;padding:80px 0"><p style="color:#aaa">Loading article...</p></div>';

    sanityFetch('*[_type == "article" && slug.current == "' + slug.replace(/"/g, '') + '"][0] { title, date, category, "image": image.asset->url, "video": video.asset->url, excerpt, tags, body }')
      .then(function (article) {
        if (!article) {
          container.innerHTML = '<p style="text-align:center;padding:60px 0;color:#888">Article not found.</p>';
          return;
        }

        document.title = (article.title || 'Article') + ' | Bagani Oil';

        var bodyHtml = '';
        if (article.body && Array.isArray(article.body)) {
          bodyHtml = article.body.map(function (block) {
            if (block._type !== 'block' || !block.children) return '';
            var text = block.children.map(function (c) {
              var t = (c.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
              if (c.marks && c.marks.indexOf('strong') > -1) t = '<strong>' + t + '</strong>';
              if (c.marks && c.marks.indexOf('em') > -1) t = '<em>' + t + '</em>';
              return t;
            }).join('');
            switch (block.style) {
              case 'h1': return '<h1>' + text + '</h1>';
              case 'h2': return '<h2>' + text + '</h2>';
              case 'h3': return '<h3>' + text + '</h3>';
              case 'blockquote': return '<blockquote><p>' + text + '</p></blockquote>';
              default: return text ? '<p class="wow fadeInUp">' + text + '</p>' : '';
            }
          }).join('');
        }

        var type = normalizeBaganiCategory(article);
        var headerType = type === 'Article' ? 'News' : type;
        var pageHeaderTitle = document.querySelector('.page-header-box h1');
        var breadcrumbActive = document.querySelector('.page-header-box .breadcrumb-item.active');
        if (pageHeaderTitle) {
          pageHeaderTitle.innerHTML = escHtml(headerType) + ' <span>Article</span>';
        }
        if (breadcrumbActive) {
          breadcrumbActive.textContent = (headerType + ' Article').toLowerCase();
        }

        var dateText = formatDate(article.date);

        var tagsHtml = '';
        if (article.tags && article.tags.length) {
          tagsHtml = '<div class="post-tag-links"><div class="post-tags wow fadeInUp"><span class="tag-links">Tags: ' +
            article.tags.map(function (t) { return '<a href="#">' + t + '</a>'; }).join('') +
            '</span></div></div>';
        }

        container.innerHTML =
          '<article class="bagani-article-shell">' +
            (article.image ? '<div class="post-image bagani-article-hero"><figure><img src="' + article.image + '" alt="' + escHtml(article.title || '') + '" style="width:100%"></figure></div>' : '') +
            (article.video ? '<div class="bagani-article-video" style="margin:0 0 30px"><video controls style="width:100%;border-radius:8px;max-height:480px"><source src="' + article.video + '">Your browser does not support video playback.</video></div>' : '') +
            '<div class="post-content bagani-article-content">' +
              '<div class="bagani-article-meta wow fadeInUp">' +
                '<span class="mag-tag ' + baganiCategoryClass(type) + '">' + type + '</span>' +
                (dateText ? '<span class="bagani-article-date"><i class="fa-regular fa-calendar"></i> ' + dateText + '</span>' : '') +
              '</div>' +
              '<div class="post-entry bagani-article-entry">' +
                '<h1 class="wow fadeInUp">' + escHtml(article.title || '') + '</h1>' +
                (article.excerpt ? '<p class="bagani-article-lead wow fadeInUp">' + escHtml(article.excerpt) + '</p>' : '') +
                bodyHtml +
              '</div>' +
              tagsHtml +
            '</div>' +
          '</article>';

        reInitWow();
      })
      .catch(function () {
        container.innerHTML = '<p style="text-align:center;padding:60px 0;color:#888">Could not load article.</p>';
      });
  }

  // ── PRODUCTS ───────────────────────────────────────────────────────────────
  function initProducts() {
    var grid = document.querySelector('.project-item-boxes');
    if (!grid) return;

    sanityFetch('*[_type == "product"] | order(line asc, name asc) { "slug": slug.current, name, line, category, spec, shortDesc, "image": image.asset->url, "viscosity": specs[key match "Viscosity*"][0].value, "engineType": specs[key match "Engine*"][0].value, "pdfUrl": pdfFile.asset->url }')
      .then(function (products) {
        if (!products || !products.length) return;

        var countEl = document.getElementById('product-count');
        if (countEl) countEl.textContent = products.length;

        function getViscosityKeys(p) {
          var keys = [];
          var v = ((p.viscosity || p.spec || '')).toLowerCase();
          if (v.indexOf('10w-40') > -1) keys.push('v10w40');
          if (v.indexOf('15w-40') > -1) keys.push('v15w40');
          if (v.indexOf('20w-40') > -1) keys.push('v20w40');
          if (v.indexOf('20w-50') > -1) keys.push('v20w50');
          if (v.indexOf('0w-20') > -1) keys.push('v0w20');
          if (v.indexOf('sae 90') > -1 || v.indexOf('sae 140') > -1) keys.push('vsae90');
          if (v.indexOf('sae 40') > -1 && v.indexOf('10w-40') === -1 && v.indexOf('15w-40') === -1 && v.indexOf('20w-40') === -1) keys.push('vsae40');
          return keys.join(' ');
        }

        function getEngineKeys(p) {
          var keys = [];
          var e = (p.engineType || '').toLowerCase();
          var line = (p.line || '').toLowerCase().trim();
          if (e.indexOf('diesel') > -1 || line === 'laon') keys.push('diesel');
          if (e.indexOf('motorcycle') > -1 || e.indexOf('scooter') > -1 || line === 'amihan' || line === 'hilaya') keys.push('motorcycle-scooter');
          if (e.indexOf('gasoline') > -1 || line === 'hanan') keys.push('gasoline');
          if (e.indexOf('gear') > -1 || line === 'aman') keys.push('gear-oil');
          if (e.indexOf('transmission') > -1 || e.indexOf('atf') > -1 || line === 'anitun') keys.push('transmission');
          return keys.join(' ');
        }

        grid.innerHTML = products.map(function (p, i) {
          var lineKey = (p.line || '').toLowerCase().trim();
          var nameLower = (p.name || '').toLowerCase();
          var filterKeywords = ['amihan', 'laon', 'aman', 'anitun', 'hilaya', 'gale', 'hanan'];
          filterKeywords.forEach(function (kw) {
            if (nameLower.indexOf(kw) > -1 && (' ' + lineKey + ' ').indexOf(' ' + kw + ' ') === -1) {
              lineKey += ' ' + kw;
            }
          });
          var viscKeys = getViscosityKeys(p);
          var engKeys = getEngineKeys(p);
          return '<div class="project-item-box" data-line="' + lineKey + '" data-viscosity="' + viscKeys + '" data-engine="' + engKeys + '" data-idx="' + i + '">' +
            '<div class="bagani-product-item">' +
              '<a href="/products/' + p.slug + '/" class="bagani-product-img-wrap">' +
                '<img src="' + (p.image || '') + '" alt="Bagani ' + p.name + '" loading="lazy">' +
              '</a>' +
              '<div class="bagani-product-info">' +
                '<span class="bagani-product-line">' + (p.line || '') + '</span>' +
                '<h3 class="bagani-product-name">' + p.name + '</h3>' +
                '<p class="bagani-product-spec">' + (p.spec || '') + '</p>' +
                '<p class="bagani-product-desc">' + (p.shortDesc || '') + '</p>' +
                '<div class="bagani-product-footer">' +
                    '<button class="card-dl-link" onclick="window.openDlModal(\'' + (p.pdfUrl || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'") + '\',\'' + (p.name || '').replace(/'/g,"\\'") + '\')"><span class="dl-full">Download TDS</span><span class="dl-short"><i class="fa-solid fa-file-pdf"></i> TDS</span></button>' +
                    '<a href="/products/' + p.slug + '/" class="bagani-product-link"><span class="dl-full">VIEW DETAILS</span><span class="dl-short">VIEW</span> <i class="fa-solid fa-arrow-right"></i></a>' +
                '</div>' +
              '</div>' +
            '</div></div>';
        }).join('');

        // ── Filter logic — runs AFTER products are in the DOM ──────────────────
        function applyFilters() {
          var groupFilters = [];
          document.querySelectorAll('.filter-group').forEach(function (group) {
            var filterType = group.dataset.filter;
            var checked = [];
            group.querySelectorAll('.filter-check:checked').forEach(function (el) {
              checked.push(el.value.replace('.', ''));
            });
            if (checked.length > 0) groupFilters.push({ type: filterType, values: checked });
          });

          var count = 0;
          grid.querySelectorAll('.project-item-box').forEach(function (item) {
            var show = groupFilters.length === 0 || groupFilters.every(function (gf) {
              return gf.values.some(function (f) {
                if (gf.type === 'line') return (' ' + item.dataset.line + ' ').indexOf(' ' + f + ' ') > -1;
                if (gf.type === 'viscosity') return (' ' + (item.dataset.viscosity || '') + ' ').indexOf(' ' + f + ' ') > -1;
                if (gf.type === 'engine') return (' ' + (item.dataset.engine || '') + ' ').indexOf(' ' + f + ' ') > -1;
                return false;
              });
            });
            item.classList.toggle('filter-hidden', !show);
            if (show) count++;
          });
          var cEl = document.getElementById('product-count');
          if (cEl) cEl.textContent = count;
        }

        // Override the global so products.njk change listeners call this version
        // (which has products in DOM via closure — no timing gap)
        window.baganiApplyFilters = applyFilters;

        // Apply URL ?filter= param if present
        var initialFilter = new URLSearchParams(window.location.search).get('filter');
        if (initialFilter) {
          var lineGroup = document.querySelector('.filter-group[data-filter="line"]');
          if (lineGroup) {
            var target = lineGroup.querySelector('.filter-check[value=".' + initialFilter + '"]');
            if (target) {
              lineGroup.querySelectorAll('.filter-check').forEach(function (sib) { sib.checked = false; });
              target.checked = true;
            }
          }
        }

        // Apply current filter state (catches any boxes checked before products loaded)
        applyFilters();
      });
  }

  // ── FAQs ───────────────────────────────────────────────────────────────────
  function initFaqs() {
    var acc1 = document.getElementById('faqaccordion1');
    var acc2 = document.getElementById('faqaccordion2');
    if (!acc1 && !acc2) return;

    sanityFetch('*[_type == "faq"] | order(order asc) { question, answer, category }')
      .then(function (faqs) {
        if (!faqs) return;

        var general = faqs.filter(function (f) { return f.category === 'general'; });
        var other = faqs.filter(function (f) { return f.category === 'product' || f.category === 'dealer'; });

        function buildAccordion(items, prefix, parentId) {
          if (!items.length) return '<p style="color:#888;padding:20px 0">No questions yet.</p>';
          return items.map(function (f, i) {
            return '<div class="accordion-item wow fadeInUp"' + (i > 0 ? ' data-wow-delay="' + (i * 0.2) + 's"' : '') + '>' +
              '<h2 class="accordion-header" id="heading' + prefix + (i + 1) + '">' +
                '<button class="accordion-button ' + (i > 0 ? 'collapsed' : '') + '" type="button" ' +
                  'data-bs-toggle="collapse" data-bs-target="#collapse' + prefix + (i + 1) + '" ' +
                  'aria-expanded="' + (i === 0 ? 'true' : 'false') + '">' +
                  f.question +
                '</button></h2>' +
              '<div id="collapse' + prefix + (i + 1) + '" class="accordion-collapse collapse ' + (i === 0 ? 'show' : '') + '" ' +
                'data-bs-parent="#' + parentId + '">' +
                '<div class="accordion-body"><p>' + f.answer + '</p></div>' +
              '</div></div>';
          }).join('');
        }

        if (acc1) acc1.innerHTML = buildAccordion(general, 'G', 'faqaccordion1');
        if (acc2) acc2.innerHTML = buildAccordion(other, 'P', 'faqaccordion2');
        reInitWow();
      });
  }

  // ── STORES ─────────────────────────────────────────────────────────────────
  function initStores() {
    if (!document.getElementById('store-map')) return;

    sanityFetch('*[_type == "store"] | order(city asc) { "slug": slug.current, name, address, city, phone, lat, lng }')
      .then(function (stores) {
        if (!stores || !stores.length) return;

        var label = document.querySelector('.section-label');
        if (label) label.textContent = stores.length + ' Stores Found';

        var tbody = document.querySelector('.product-specs-table tbody');
        if (tbody) {
          tbody.innerHTML = stores.map(function (s) {
            return '<tr>' +
              '<td><strong>' + s.name + '</strong></td>' +
              '<td>' + (s.address || '') + '</td>' +
              '<td>' + (s.city || '') + '</td>' +
              '<td style="white-space:nowrap">' + (s.phone ? '<a href="tel:' + s.phone + '">' + s.phone + '</a>' : '—') + '</td>' +
            '</tr>';
          }).join('');
        }

        // Refresh map markers if exposed globally
        if (typeof window.baganiRefreshMap === 'function') {
          window.baganiRefreshMap(stores);
        }
      });
  }

  // ── DISPATCH ───────────────────────────────────────────────────────────────
  var page = document.body.getAttribute('data-page');
  if (page === 'news') initNews();
  else if (page === 'news-article') initNewsArticle();
  else if (page === 'products') initProducts();
  else if (page === 'faqs') initFaqs();
  else if (page === 'stores') initStores();

})();
