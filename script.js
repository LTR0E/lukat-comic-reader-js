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

        this.fileInput = document.getElementById('fileInput');
        this.prevButton = document.querySelector('.prevButton');
        this.nextButton = document.querySelector('.nextButton');
        this.pageDisplay = document.getElementById('pageDisplay');
        this.pageInfo = document.getElementById('pageInfo');
        this.fullscreenButton = document.getElementById('fullscreenButton');

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.prevButton.addEventListener('click', () => this.previousPage());
        this.nextButton.addEventListener('click', () => this.nextPage());
        this.fullscreenButton.addEventListener('click', () => this.toggleFullScreen());
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
    }
    
    toggleFullScreen() {
        const readerElement = document.querySelector('.reader');
        if (!document.fullscreenElement) {
            readerElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        document.getElementById('errorMessage').style.display = 'none';
        document.getElementById('loader').style.display = 'flex'; // Show loader

        this.loading = true;
        this.updateUI();

        try {
            if (typeof Unarchiver === 'undefined') {
                throw new Error('Unarchiver library not loaded');
            }


            const archive = await Unarchiver.open(file);

            const pageEntries = [];

            // First, collect all valid image entries with their filenames
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
                // First try to sort by page number
                if (a.pageNum !== b.pageNum) {
                    return a.pageNum - b.pageNum;
                }
                // If page numbers are the same or not found, sort by filename
                return a.filename.localeCompare(b.filename, undefined, {numeric: true, sensitivity: 'base'});
            });

            // Now read the files in the correct order
            this.pages = [];
            let loadedCount = 0;
            for (const pageEntry of pageEntries) {
                const entryFile = await pageEntry.entry.read();
                const url = URL.createObjectURL(entryFile);
                this.pages.push({ url, filename: pageEntry.filename, pageNum: pageEntry.pageNum });
                loadedCount++;
                document.getElementById('progressInfo').textContent =
                    `Loaded ${loadedCount} of ${pageEntries.length} pages...`;
                // Let the UI update after each page
                await new Promise(r => setTimeout(r, 0));
            }

            if (this.pages.length === 0) {
                throw new Error('No valid images found in the archive');
            }
            
            document.getElementById('loader').style.display = 'none'; // Hide loader
            this.loading = false;
            this.currentPage = 0;
            this.updateUI();
            this.displayCurrentPage();
        } catch (error) {
            console.error('Error reading comic file:', error);
            showError(`Error reading comic file: ${error.message}`);
            document.getElementById('loader').style.display = 'none';
            this.pages = [];
            this.currentPage = 0;
            this.loading = false;
            this.updateUI();
        } finally {
            this.loading = false;
            this.updateUI();
        }
    }

    isImageFile(filename) {
        const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        return extensions.some(ext => filename.toLowerCase().endsWith(ext));
    }

    displayCurrentPage() {
        if (this.pages.length > 0) {
            this.pageDisplay.src = this.pages[this.currentPage].url;
            this.updatePageInfo();
        } else {
            this.pageDisplay.src = '';
        }
    }

    previousPage() {
        if (this.currentPage > 0) {
            this.currentPage--;
            this.displayCurrentPage();
            this.updateUI();
        }
    }

    nextPage() {
        if (this.currentPage < this.pages.length - 1) {
            this.currentPage++;
            this.displayCurrentPage();
            this.updateUI();
        }
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
    }

    updatePageInfo() {
        if (this.pages.length > 0) {
            const currentPage = this.pages[this.currentPage];
            // Display the current page number and filename and fade out after 4 seconds
            setTimeout(() => {
                this.pageInfo.textContent = `Page ${currentPage.pageNum} - ${currentPage.filename}`;
                this.pageInfo.style.opacity = 1;
                this.pageInfo.style.transition = 'none';
                setTimeout(() => {
                    this.pageInfo.style.opacity = 0;
                    this.pageInfo.style.transition = 'opacity 1s ease-out';
                }, 4000);
            })
        } else {
            this.pageInfo.textContent = this.loading ? 'Loading...' : 'No comic loaded';
        }
    }
}

// Initialize the comic reader when the page is fully loaded
window.addEventListener('load', function() {
    const reader = new ComicReader();
});
