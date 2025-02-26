// Check if Unarchiver is loaded
window.addEventListener('load', function() {
    if (typeof Unarchiver === 'undefined') {
        showError('Error: Unarchiver library not loaded. Please check your internet connection and reload the page.');
    }
});

function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

function extractPageNumber(filename) {
    // Match any number in the filename
    const match = filename.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
}

class ComicReader {
    constructor() {
        this.currentPage = 0;
        this.pages = [];
        this.loading = false;
        this.fullscreen = false;
        this.readingDirection = 'ltr'; // Left-to-right by default
        this.hideProgressTimeout = null;
        this.showProgressTimeout = null;
        this.pageInfoTimeout = null;

        this.fileInput = document.getElementById('fileInput');
        this.prevButton = document.querySelector('.prevButton');
        this.nextButton = document.querySelector('.nextButton');
        this.pageDisplay = document.getElementById('pageDisplay');
        this.pageInfo = document.getElementById('pageInfo');
        this.showPageInfoCheckbox = document.getElementById('showPageInfoCheckbox');
        this.fullscreenButton = document.getElementById('fullscreenButton');

        this.settingsButton = document.getElementById('settingsButton');
        this.settingsMenu = document.getElementById('settingsMenu');
        this.readingDirectionSelect = document.getElementById('readingDirectionSelect');

        
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.prevButton.addEventListener('click', () => this.previousPage());
        this.nextButton.addEventListener('click', () => this.nextPage());
        this.fullscreenButton.addEventListener('click', () => this.toggleFullScreen());
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        
        this.settingsButton.addEventListener('click', () => {
            this.settingsMenu.style.display = (this.settingsMenu.style.display === 'none' ? 'block' : 'none');
        });
        this.readingDirectionSelect.addEventListener('change', (e) => {
            this.readingDirection = e.target.value;
        });

        this.showPageInfoCheckbox.addEventListener('change', (e) => {
            const checked = e.target.checked;
            this.pageInfo.style.display = checked ? 'block' : 'none';
        });

        document.addEventListener('fullscreenchange', () => {
            clearTimeout(this.hideProgressTimeout);
            const progress = document.getElementById('readProgress');
            const text = document.getElementById('progress-text');
        
            if (document.fullscreenElement) {
                this.hideProgressTimeout = setTimeout(() => {
                    progress.classList.add('fade-out');
                    text.classList.add('fade-out');
                }, 2000);
            } else {
                progress.classList.remove('fade-out');
                text.classList.remove('fade-out');
            }
        });

        // Show progress elements briefly when changing pages
        const showProgressBriefly = () => {
            if (document.fullscreenElement) {
                clearTimeout(this.showProgressTimeout);
                
                const progress = document.getElementById('readProgress');
                const text = document.getElementById('progress-text');
                
                progress.classList.remove('fade-out');
                text.classList.remove('fade-out');
                
                this.showProgressTimeout = setTimeout(() => {
                    progress.classList.add('fade-out');
                    text.classList.add('fade-out');
                }, 2000);
            }
        };

        this.prevButton.addEventListener('click', showProgressBriefly);
        this.nextButton.addEventListener('click', showProgressBriefly);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                showProgressBriefly();
            }
        });

        this.prevButton.addEventListener('click', showProgressBriefly);
        this.nextButton.addEventListener('click', showProgressBriefly);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            showProgressBriefly();
            }
        });

        let startX = 0, startY = 0;
        let threshold = 50; // Swipe threshold in px

        const handleTouchStart = (e) => {
            if (e.touches.length > 1) return; // Ignore multi-touch
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        };

        const handleTouchEnd = (e) => {
            if (!startX) return;
            let endX = e.changedTouches[0].clientX;
            let endY = e.changedTouches[0].clientY;

            let distX = endX - startX;
            let distY = endY - startY;

            // Ensure horizontal movement is dominant
            if (Math.abs(distX) > Math.abs(distY) && Math.abs(distX) > threshold) {
                if (distX < 0) {
                    // Swiped left
                    this.nextPage();
                } else {
                    // Swiped right
                    this.previousPage();
                }
            }
            startX = 0;
            startY = 0;
        };

        const readerElement = document.querySelector('.reader');
        readerElement.addEventListener('touchstart', handleTouchStart, { passive: true });
        readerElement.addEventListener('touchend', handleTouchEnd);
    }

    toggleFullScreen() {
        const readerElement = document.querySelector('.reader');
        if (!document.fullscreenElement) {
            readerElement.requestFullscreen();
            this.fullscreen = true;
        } else {
            document.exitFullscreen();
            this.fullscreen = false;
        }
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        this.clearPreviousFileData();
        document.getElementById('errorMessage').style.display = 'none';
        document.getElementById('loader').style.display = 'flex';
        this.loading = true;
        this.updateUI();
    
        try {
            if (typeof Unarchiver === 'undefined') {
                throw new Error('Unarchiver library not loaded');
            }
    
            const archive = await Unarchiver.open(file);
            
            // Step 1: Collect and sort entries first (no loading yet)
            const pageEntries = [];
            for (let entry of archive.entries) {
                if (entry.is_file && this.isImageFile(entry.name)) {
                    pageEntries.push({
                        entry: entry,
                        filename: entry.name,
                        pageNum: extractPageNumber(entry.name)
                    });
                }
            }
            
            // Sort entries by page number
            pageEntries.sort((a, b) => {
                if (a.pageNum !== b.pageNum) {
                    return a.pageNum - b.pageNum;
                }
                return a.filename.localeCompare(b.filename, undefined, {numeric: true, sensitivity: 'base'});
            });
            
            // Create placeholder array with correct length
            this.pages = new Array(pageEntries.length).fill(null);
            
            // Step 2: Start loading images and update UI progressively
            this.loadImagesProgressively(pageEntries);
            
        } catch (error) {
            console.error('Error reading comic file:', error);
            showError(`Error reading comic file: ${error.message}`);
            document.getElementById('loader').style.display = 'none';
            this.pages = [];
            this.currentPage = 0;
            this.loading = false;
            this.updateUI();
        }
    }

    async loadImagesProgressively(pageEntries) {
        const total = pageEntries.length;
        let loaded = 0;
        
        // Create an array of promises for loading all pages
        const loadPromises = pageEntries.map(async (pageEntry, index) => {
            try {
                const entryFile = await pageEntry.entry.read();
                const url = URL.createObjectURL(entryFile);
                
                // Store page at its correct index
                this.pages[index] = { 
                    url, 
                    filename: pageEntry.filename, 
                    pageNum: pageEntry.pageNum,
                    loaded: true
                };
                
                loaded++;
                document.getElementById('progressInfo').textContent = 
                    `Loaded ${loaded} of ${total} pages...`;
                    
                // If this is the first page and we haven't displayed anything yet, show it
                if (this.currentPage === index || (this.currentPage === 0 && index === 0 && !this.pageDisplay.src)) {
                    this.displayCurrentPage();
                }
                
                // Update UI periodically, not after every single page
                if (loaded % 5 === 0 || loaded === total) {
                    this.updateUI();
                    this.updateProgressBar();
                }
                
                // Allow UI to update
                await new Promise(r => setTimeout(r, 0));
                
            } catch (error) {
                console.error(`Error loading page ${index}:`, error);
                this.pages[index] = { 
                    error: true, 
                    filename: pageEntry.filename,
                    pageNum: pageEntry.pageNum 
                };
            }
        });
        
        // Wait for all pages to load
        await Promise.all(loadPromises);
        
        // Complete loading
        document.getElementById('loader').style.display = 'none';
        this.loading = false;
        this.updateUI();
        
        // Make sure we're showing a page
        if (!this.pageDisplay.src && this.pages.length > 0) {
            this.displayCurrentPage();
        }
    }

    clearPreviousFileData() {
        // Revoke all object URLs to prevent memory leaks
        if (this.pages && this.pages.length > 0) {
            for (const page of this.pages) {
                if (page && page.url) {
                    URL.revokeObjectURL(page.url);
                }
            }
        }
        
        // Reset all state variables
        this.pages = [];
        this.currentPage = 0;
        this.pageDisplay.src = '';
        this.pageInfo.textContent = 'Loading...';
        
        // Reset progress
        const progress = document.getElementById('readProgress');
        const progressText = document.getElementById('progress-text');
        progress.value = 0;
        progressText.textContent = '0%';
    }
    
    isImageFile(filename) {
        const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        return extensions.some(ext => filename.toLowerCase().endsWith(ext));
    }

    displayCurrentPage() {
        if (this.pages.length > 0) {
            const currentPageData = this.pages[this.currentPage];
            
            if (currentPageData && currentPageData.loaded) {
                // Page is loaded, display it
                this.pageDisplay.src = currentPageData.url;
                this.updatePageInfo();
            } else if (currentPageData && currentPageData.error) {
                // Page had an error loading
                this.pageDisplay.src = '';
                this.pageInfo.textContent = `Error loading page ${this.currentPage + 1}`;
            } else {
                // Page is still loading
                this.pageDisplay.src = '';
                this.pageInfo.textContent = 'Loading page...';
            }
        } else {
            this.pageDisplay.src = '';
        }
    }

    previousPage() {
        if (this.readingDirection === 'ltr') {
            if (this.currentPage > 0) {
                this.currentPage--;
                this.displayCurrentPage();
                this.updateUI();
                this.updateProgressBar();
            }
        } else {
            // RTL: 'previous' goes forward
            if (this.currentPage < this.pages.length - 1) {
                this.currentPage++;
                this.displayCurrentPage();
                this.updateUI();
                this.updateProgressBar();
            }
        }
    }

    nextPage() {
        if (this.readingDirection === 'ltr') {
            if (this.currentPage < this.pages.length - 1) {
                this.currentPage++;
                this.displayCurrentPage();
                this.updateUI();
                this.updateProgressBar();
            }
        } else {
            // RTL: 'next' goes backward
            if (this.currentPage > 0) {
                this.currentPage--;
                this.displayCurrentPage();
                this.updateUI();
                this.updateProgressBar();
            }
        }
    }

    updateProgressBar() {
        const progressText = document.getElementById('progress-text');
        const progress = document.getElementById('readProgress');
        progress.value = ((this.currentPage + 1) / this.pages.length) * 100;
        progressText.textContent = Math.round(progress.value) + '%'; // Display percentage as textprogress.value + '%';
    }

    
    handleKeyPress(event) {
        switch(event.key) {
            case 'ArrowLeft':
                this.previousPage();
                break;
            case 'ArrowRight':
                this.nextPage();
                break;
        }
    }

    updateUI() {
        this.prevButton.disabled = this.currentPage <= 0 || this.loading;
        this.nextButton.disabled = this.currentPage >= this.pages.length - 1 || this.loading;
        this.updatePageInfo();
        
        // Update progress info if we're still loading
        if (this.loading) {
            const loadedCount = this.pages.filter(p => p && (p.loaded || p.error)).length;
            document.getElementById('progressInfo').textContent = 
                `Loaded ${loadedCount} of ${this.pages.length} pages...`;
        }
    }

    updatePageInfo() {
        if (this.pages.length > 0) {
            const currentPage = this.pages[this.currentPage];
            
            // Clear any existing timeout
            clearTimeout(this.pageInfoTimeout);
            
            // Set new timeout for page info display
            this.pageInfoTimeout = setTimeout(() => {
                // Check if currentPage exists and has pageNum property
                if (currentPage && currentPage.pageNum !== undefined) {
                    this.pageInfo.textContent = `Page ${currentPage.pageNum} - ${currentPage.filename}`;
                } else if (this.loading) {
                    this.pageInfo.textContent = `Loading page ${this.currentPage + 1}...`;
                } else {
                    this.pageInfo.textContent = `Page ${this.currentPage + 1} of ${this.pages.length}`;
                }
                
                this.pageInfo.style.opacity = 1;
                this.pageInfo.style.transition = 'none';
                
                // Clear previous fade timeout and set new one
                clearTimeout(this.pageInfoTimeout);
                this.pageInfoTimeout = setTimeout(() => {
                    this.pageInfo.style.opacity = 0;
                    this.pageInfo.style.transition = 'opacity 1s ease-out';
                }, 3000);
            });
        } else {
            this.pageInfo.textContent = this.loading ? 'Loading...' : 'No comic loaded';
        }
        if (!this.showPageInfoCheckbox.checked) {
            this.pageInfo.style.display = 'none';
            return;
        }
    }
}

// Initialize the comic reader when the page is fully loaded
window.addEventListener('load', function() {
    const reader = new ComicReader();
});
