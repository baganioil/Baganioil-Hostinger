(function ($) {
    "use strict";
	
	var $window = $(window); 
	var $body = $('body'); 

	/* Preloader Effect */
	function hidePreloader() {
		$(".preloader").addClass("loaded");
		setTimeout(function() {
			$(".preloader").css("display", "none");
		}, 800);
	}
	$window.on('load', hidePreloader);
	setTimeout(hidePreloader, 2000);

	/* Sticky Header */	
	if($('.active-sticky-header').length){
		$window.on('resize', function(){
			setHeaderHeight();
		});

		function setHeaderHeight(){
	 		$("header.main-header").css("height", $('header .header-sticky').outerHeight());
		}	
	
		$window.on("scroll", function() {
			var fromTop = $(window).scrollTop();
			setHeaderHeight();
			var headerHeight = $('header .header-sticky').outerHeight()
			$("header .header-sticky").toggleClass("hide", (fromTop > headerHeight + 100));
			$("header .header-sticky").toggleClass("active", (fromTop > 600));
		});
	}	
	
	/* Slick Menu JS */
	$('#menu').slicknav({
		label : '',
		prependTo : '.responsive-menu'
	});

	if($("a[href='#top']").length){
		$(document).on("click", "a[href='#top']", function() {
			$("html, body").animate({ scrollTop: 0 }, "slow");
			return false;
		});
	}

	/* Hero Slider Layout JS */
	const hero_slider_layout = new Swiper('.hero-slider-layout .swiper', {
		slidesPerView : 1,
		speed: 1000,
		spaceBetween: 0,
		loop: true,
		autoplay: {
			delay: 4000,
		},
		pagination: {
			el: '.hero-pagination',
			clickable: true,
		},
	});

	/* What We Do — card slider on mobile only */
	var whatWeDoSwiper = null;

	function initWhatWeDoSwiper() {
		if (window.innerWidth < 992) {
			if (!whatWeDoSwiper && document.querySelector('.what-we-do-swiper')) {
				whatWeDoSwiper = new Swiper('.what-we-do-swiper', {
					slidesPerView: 1.15,
					spaceBetween: 16,
					centeredSlides: false,
					loop: false,
					pagination: {
						el: '.what-we-do-pagination',
						clickable: true,
					},
				});
			}
		} else {
			if (whatWeDoSwiper) {
				whatWeDoSwiper.destroy(true, true);
				whatWeDoSwiper = null;
			}
		}
	}

	initWhatWeDoSwiper();
	window.addEventListener('resize', initWhatWeDoSwiper);

	/* Product Lines — services card slider (always on) */
	if (document.querySelector('.services-list-swiper')) {
		const servicesListSwiper = new Swiper('.services-list-swiper', {
			slidesPerView: 1,
			spaceBetween: 20,
			loop: true,
			centeredSlides: false,
			grabCursor: true,
			speed: 600,
			navigation: {
				nextEl: '.services-swiper-next',
				prevEl: '.services-swiper-prev',
			},
			pagination: {
				el: '.services-swiper-pagination',
				clickable: true,
			},
			breakpoints: {
				576: {
					slidesPerView: 2,
					spaceBetween: 20,
				},
				992: {
					slidesPerView: 3,
					spaceBetween: 24,
				},
				1200: {
					slidesPerView: 4,
					spaceBetween: 24,
				},
			},
		});
	}

	/* testimonial Slider JS */
	if ($('.testimonial-slider').length) {
		const testimonial_slider = new Swiper('.testimonial-slider .swiper', {
			slidesPerView : 1,
			speed: 1000,
			spaceBetween: 30,
			loop: true,
			autoplay: {
				delay: 5000,
			},
			pagination: {
				el: '.swiper-pagination',
				clickable: true,
			},
			navigation: {
				nextEl: '.testimonial-button-next',
				prevEl: '.testimonial-button-prev',
			},
			breakpoints: {
				768:{
				  	slidesPerView: 1,
				},
				991:{
				  	slidesPerView: 1,
				}
			}
		});
	}

	if ($('.testimonial-company-slider').length) {
		const testimonial_company_slider = new Swiper('.testimonial-company-slider .swiper', {
			slidesPerView : 2,
			speed: 2000,
			spaceBetween: 30,
			loop: true,
			autoplay: {
				delay: 5000,
			},
			breakpoints: {
				768:{
				  	slidesPerView: 4,
				},
				991:{
				  	slidesPerView: 5,
				}
			}
		});
	}

	/* Skill Bar */
	if ($('.skills-progress-bar').length) {
		$('.skills-progress-bar').waypoint(function() {
			$('.skillbar').each(function() {
				$(this).find('.count-bar').animate({
				width:$(this).attr('data-percent')
				},2000);
			});
		},{
			offset: '50%'
		});
	}

	/* Youtube Background Video JS */
	if ($('#herovideo').length) {
		var myPlayer = $("#herovideo").YTPlayer();
	}

	/* Init Counter */
	if ($('.counter').length) {
		$('.counter').counterUp({ delay: 5, time: 2000 });
	}

	/* Image Reveal Animation */
	if ($('.reveal').length) {
        gsap.registerPlugin(ScrollTrigger);
        let revealContainers = document.querySelectorAll(".reveal");
        revealContainers.forEach((container) => {
            let image = container.querySelector("img");
            let tl = gsap.timeline({
                scrollTrigger: {
                    trigger: container,
                    toggleActions: "play none none none"
                }
            });
            tl.set(container, {
                autoAlpha: 1
            });
            tl.from(container, 1, {
                xPercent: -100,
                ease: Power2.out
            });
            tl.from(image, 1, {
                xPercent: 100,
                scale: 1,
                delay: -1,
                ease: Power2.out
            });
        });
    }

	/* Text Effect Animation */
	if ($('.text-anime-style-1').length) {
		let staggerAmount 	= 0.05,
			translateXValue = 0,
			delayValue 		= 0.5,
		   animatedTextElements = document.querySelectorAll('.text-anime-style-1');
		
		animatedTextElements.forEach((element) => {
			let animationSplitText = new SplitText(element, { type: "chars, words" });
				gsap.from(animationSplitText.words, {
				duration: 1,
				delay: delayValue,
				x: 20,
				autoAlpha: 0,
				stagger: staggerAmount,
				scrollTrigger: { trigger: element, start: "top 85%" },
				});
		});		
	}
	
	if ($('.text-anime-style-2').length) {
		let	 staggerAmount 		= 0.03,
			 translateXValue	= 20,
			 delayValue 		= 0.1,
			 easeType 			= "power2.out",
			 animatedTextElements = document.querySelectorAll('.text-anime-style-2');

		animatedTextElements.forEach((element) => {
			// Use word-index matching to avoid false positives on repeated words
			var fullWords = element.textContent.trim().split(/\s+/);
			var gradientIndices = new Set();
			element.querySelectorAll('span').forEach(function(span) {
				var spanWords = span.textContent.trim().split(/\s+/);
				for (var i = 0; i <= fullWords.length - spanWords.length; i++) {
					var match = spanWords.every(function(w, j) {
						return fullWords[i + j].toLowerCase() === w.toLowerCase();
					});
					if (match) {
						for (var j = 0; j < spanWords.length; j++) gradientIndices.add(i + j);
						break;
					}
				}
			});

			let animationSplitText = new SplitText(element, { type: "chars, words" });

			// Apply gradient to each char element (chars have direct text nodes, words don't)
			if (gradientIndices.size > 0) {
				animationSplitText.words.forEach(function(wordEl, idx) {
					if (gradientIndices.has(idx)) {
						wordEl.querySelectorAll('div, span').forEach(function(charEl) {
							charEl.style.background = 'linear-gradient(135deg, #FFD700 0%, #FFC107 50%, #FF8C00 100%)';
							charEl.style.webkitBackgroundClip = 'text';
							charEl.style.webkitTextFillColor = 'transparent';
							charEl.style.backgroundClip = 'text';
							charEl.style.color = '#FFC107';
						});
					}
				});
			}

			gsap.from(animationSplitText.chars, {
					duration: 1,
					delay: delayValue,
					x: translateXValue,
					autoAlpha: 0,
					stagger: staggerAmount,
					ease: easeType,
					scrollTrigger: { trigger: element, start: "top 85%"},
				});
		});
	}
	
	if ($('.text-anime-style-3').length) {
		let	animatedTextElements = document.querySelectorAll('.text-anime-style-3');

		animatedTextElements.forEach((element) => {
			//Reset if needed
			if (element.animation) {
				element.animation.progress(1).kill();
				element.split.revert();
			}

			// Use word-index matching to avoid false positives on repeated words
			var fullWords3 = element.textContent.trim().split(/\s+/);
			var gradientIndices3 = new Set();
			element.querySelectorAll('span').forEach(function(span) {
				var spanWords = span.textContent.trim().split(/\s+/);
				for (var i = 0; i <= fullWords3.length - spanWords.length; i++) {
					var match = spanWords.every(function(w, j) {
						return fullWords3[i + j].toLowerCase() === w.toLowerCase();
					});
					if (match) {
						for (var j = 0; j < spanWords.length; j++) gradientIndices3.add(i + j);
						break;
					}
				}
			});

			element.split = new SplitText(element, {
				type: "lines,words,chars",
				linesClass: "split-line",
			});

			// Apply gradient to each char element within gradient word positions
			if (gradientIndices3.size > 0) {
				element.split.words.forEach(function(wordEl, idx) {
					if (gradientIndices3.has(idx)) {
						wordEl.querySelectorAll('div, span').forEach(function(charEl) {
							charEl.style.background = 'linear-gradient(135deg, #FFD700 0%, #FFC107 50%, #FF8C00 100%)';
							charEl.style.webkitBackgroundClip = 'text';
							charEl.style.webkitTextFillColor = 'transparent';
							charEl.style.backgroundClip = 'text';
							charEl.style.color = '#FFC107';
						});
					}
				});
			}

			gsap.set(element, { perspective: 400 });

			gsap.set(element.split.chars, {
				opacity: 0,
				x: "50",
			});

			element.animation = gsap.to(element.split.chars, {
				scrollTrigger: { trigger: element, start: "top 90%" },
				x: "0",
				y: "0",
				rotateX: "0",
				opacity: 1,
				duration: 1,
				ease: Back.easeOut,
				stagger: 0.02,
			});
		});
	}

	/* Parallaxie js */
	var $parallaxie = $('.parallaxie');
	if($parallaxie.length && ($window.width() > 991))
	{
		if ($window.width() > 768) {
			$parallaxie.parallaxie({
				speed: 0.55,
				offset: 0,
			});
		}
	}

	/* Zoom Gallery screenshot */
	$('.gallery-items').magnificPopup({
		delegate: 'a',
		type: 'image',
		closeOnContentClick: false,
		closeBtnInside: false,
		mainClass: 'mfp-with-zoom',
		image: {
			verticalFit: true,
		},
		gallery: {
			enabled: true
		},
		zoom: {
			enabled: true,
			duration: 300, // don't foget to change the duration also in CSS
			opener: function(element) {
			  return element.find('img');
			}
		}
	});

	/* Contact form validation */
	var $contactform = $("#contactForm");
	$contactform.validator({focus: false}).on("submit", function (event) {
		if (!event.isDefaultPrevented()) {
			event.preventDefault();
			submitForm();
		}
	});

	function submitForm(){
		var data = {
			fname:      ($contactform.find('[name="fname"]').val() || '').trim(),
			lname:      ($contactform.find('[name="lname"]').val() || '').trim(),
			email:      ($contactform.find('[name="email"]').val() || '').trim(),
			phone:      ($contactform.find('[name="phone"]').val() || '').trim(),
			store_name: ($contactform.find('[name="store_name"]').val() || '').trim(),
			message:    ($contactform.find('[name="message"]').val() || '').trim(),
			_subject:   'New Message from Bagani Website',
			_captcha:   'false'
		};
		fetch('https://formsubmit.co/ajax/info@baganioil.ph', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
			body: JSON.stringify(data)
		})
		.then(function(res) { return res.json(); })
		.then(function(json) {
			if (json.success === 'true' || json.success === true) {
				formSuccess();
			} else {
				submitMSG(false, json.message || 'Something went wrong. Please try again.');
			}
		})
		.catch(function() {
			submitMSG(false, 'Something went wrong. Please try again.');
		});
	}

	function formSuccess(){
		$contactform[0].reset();
		submitMSG(true, "Message Sent Successfully!")
	}

	function submitMSG(valid, msg){
		if(valid){
			var msgClasses = "h4 text-success";
		} else {
			var msgClasses = "h4 text-danger";
		}
		$("#msgSubmit").removeClass().addClass(msgClasses).text(msg);
	}
	/* Contact form validation end */

	/* Our Project (filtering) Isotope removed to prevent CSS Grid conflict */

	/* ── Site Search ── */
	var searchIndex = [
		{ title: 'Home', desc: 'Bagani main page', url: '/' },
		{ title: 'About Us', desc: 'Our story, mission, and vision', url: '/about/' },
		{ title: 'Products', desc: 'All Bagani engine oils', url: '/products/' },
		{ title: 'Amihan — Motorcycle Oils', desc: 'Motorcycle & scooter engine oils', url: '/products/?filter=amihan' },
		{ title: 'Laon — Diesel Engine Oil', desc: 'Heavy-duty diesel engine oil', url: '/products/?filter=laon' },
		{ title: 'Aman — Gear Oils', desc: 'Gear protection oils', url: '/products/?filter=aman' },
		{ title: 'Anitun — Transmission Fluid', desc: 'ATF transmission fluids', url: '/products/?filter=anitun' },
		{ title: 'Hilaya — Fork Oil', desc: 'Motorcycle fork / suspension oil', url: '/products/?filter=hilaya' },
		{ title: 'Hanan — Gasoline Engine Oil', desc: 'Gasoline car engine oil', url: '/products/?filter=hanan' },
		{ title: 'Gale — Motorcycle Oil', desc: 'Motorcycle engine oil', url: '/products/?filter=gale' },
		{ title: 'News & Updates', desc: 'Latest Bagani announcements', url: '/news/' },
		{ title: 'Contact Us', desc: 'Get in touch with Bagani', url: '/contact/' },
	];

	var searchInput = document.getElementById('site-search-input');
	var mostSearched = document.getElementById('search-most-searched');
	var resultsPane = document.getElementById('search-results-pane');

	function buildSearchResults(query) {
		var q = query.trim().toLowerCase();
		if (!q) {
			mostSearched.style.display = '';
			resultsPane.style.display = 'none';
			return;
		}
		mostSearched.style.display = 'none';
		resultsPane.style.display = '';

		var matches = searchIndex.filter(function(item) {
			return (item.title + ' ' + item.desc).toLowerCase().indexOf(q) > -1;
		}).slice(0, 3);

		if (!matches.length) {
			resultsPane.innerHTML = '<div class="search-no-results">No results found for &ldquo;' + query.replace(/</g,'&lt;') + '&rdquo;</div>';
			return;
		}

		resultsPane.innerHTML = matches.map(function(item) {
			return '<div class="search-result-item">' +
				'<a href="' + item.url + '">' +
					'<span class="search-result-title">' + item.title + '</span>' +
					'<span class="search-result-desc">' + item.desc + '</span>' +
				'</a>' +
			'</div>';
		}).join('');
	}

	if (searchInput) {
		searchInput.addEventListener('input', function() {
			buildSearchResults(this.value);
		});

		// Submit on Enter
		searchInput.addEventListener('keydown', function(e) {
			if (e.key === 'Enter') {
				var q = this.value.trim();
				if (q) window.location.href = '/products/?search=' + encodeURIComponent(q);
			}
		});
	}

	/* Animated Wow Js */
	new WOW().init();

	/* Popup Video */
	if ($('.popup-video').length) {
		$('.popup-video').magnificPopup({
			type: 'iframe',
			mainClass: 'mfp-fade',
			removalDelay: 160,
			preloader: false,
			fixedContentPos: true
		});
	}
	
	/* Why Choose us active Start */
	if ($('.process-steps-box').length) {
		var element = $('.process-steps-box');            
		var items = element.find('.process-step-item');
		if (items.length) {
			items.on({
				mouseenter: function() {
					if($(this).hasClass('active')) return;

					items.removeClass('active');
					$(this).addClass('active');

				},
				mouseleave: function() {
					//stuff to do on mouse leave
				}
			});
		}                 
	}
	/* Why Choose us active End */
	
})(jQuery);