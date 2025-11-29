document.addEventListener('DOMContentLoaded', () => {
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const removeBtn = document.getElementById('removeBtn');
    const waveformContainer = document.getElementById('waveformContainer');
    const waveformCanvas = document.getElementById('waveformCanvas');
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const progressPercent = document.getElementById('progressPercent');
    const convertBtn = document.getElementById('convertBtn');
    const successContainer = document.getElementById('successContainer');
    const originalSize = document.getElementById('originalSize');
    const convertedSize = document.getElementById('convertedSize');
    const downloadBtn = document.getElementById('downloadBtn');
    const newFileBtn = document.getElementById('newFileBtn');

    let currentFile = null;
    let audioBuffer = null;
    let mp3Blob = null;
    let audioContext = null;

    uploadZone.addEventListener('click', () => fileInput.click());

    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    removeBtn.addEventListener('click', resetApp);
    newFileBtn.addEventListener('click', resetApp);

    convertBtn.addEventListener('click', convertToMp3);

    downloadBtn.addEventListener('click', () => {
        if (mp3Blob) {
            const url = URL.createObjectURL(mp3Blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = currentFile.name.replace('.wav', '.mp3');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    });

    function handleFile(file) {
        if (!file.name.toLowerCase().endsWith('.wav')) {
            showNotification('Please select a WAV file');
            return;
        }

        currentFile = file;
        
        uploadZone.classList.add('hidden');
        fileInfo.classList.remove('hidden');
        
        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);
        
        loadAudioAndDrawWaveform(file);
        
        convertBtn.classList.remove('hidden');
    }

    function loadAudioAndDrawWaveform(file) {
        if (audioContext) {
            audioContext.close().catch(() => {});
        }
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                audioBuffer = await audioContext.decodeAudioData(e.target.result);
                drawWaveform(audioBuffer);
                waveformContainer.classList.remove('hidden');
                if (audioContext) {
                    audioContext.close().catch(() => {});
                    audioContext = null;
                }
            } catch (error) {
                console.error('Error decoding audio:', error);
                showNotification('Error reading audio file');
                if (audioContext) {
                    audioContext.close().catch(() => {});
                    audioContext = null;
                }
            }
        };

        reader.readAsArrayBuffer(file);
    }

    function drawWaveform(buffer) {
        const canvas = waveformCanvas;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        
        canvas.width = canvas.offsetWidth * dpr;
        canvas.height = canvas.offsetHeight * dpr;
        ctx.scale(dpr, dpr);

        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;
        const data = buffer.getChannelData(0);
        const step = Math.ceil(data.length / width);
        const amp = height / 2;

        ctx.clearRect(0, 0, width, height);

        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, '#6366f1');
        gradient.addColorStop(0.5, '#818cf8');
        gradient.addColorStop(1, '#6366f1');
        
        ctx.fillStyle = gradient;

        for (let i = 0; i < width; i++) {
            let min = 1.0;
            let max = -1.0;
            
            for (let j = 0; j < step; j++) {
                const datum = data[(i * step) + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }

            const barHeight = Math.max(2, (max - min) * amp);
            const y = amp - (barHeight / 2);
            
            ctx.beginPath();
            ctx.roundRect(i, y, 1, barHeight, 0.5);
            ctx.fill();
        }

        animateWaveform();
    }

    function animateWaveform() {
        const canvas = waveformCanvas;
        canvas.style.opacity = '0';
        canvas.style.transform = 'scaleY(0)';
        
        requestAnimationFrame(() => {
            canvas.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            canvas.style.opacity = '1';
            canvas.style.transform = 'scaleY(1)';
        });
    }

    async function convertToMp3() {
        if (!audioBuffer) return;

        convertBtn.classList.add('hidden');
        progressContainer.classList.remove('hidden');
        
        progressText.textContent = 'Preparing audio...';
        updateProgress(5);

        await delay(200);

        try {
            const channels = audioBuffer.numberOfChannels;
            const sampleRate = audioBuffer.sampleRate;
            const samples = audioBuffer.length;
            
            const leftChannel = audioBuffer.getChannelData(0);
            const rightChannel = channels > 1 ? audioBuffer.getChannelData(1) : leftChannel;

            progressText.textContent = 'Encoding MP3...';
            updateProgress(10);

            const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, 128);
            const mp3Data = [];

            const sampleBlockSize = 1152;
            const totalBlocks = Math.ceil(samples / sampleBlockSize);
            let processedBlocks = 0;

            for (let i = 0; i < samples; i += sampleBlockSize) {
                const leftChunk = new Int16Array(sampleBlockSize);
                const rightChunk = new Int16Array(sampleBlockSize);

                for (let j = 0; j < sampleBlockSize && (i + j) < samples; j++) {
                    leftChunk[j] = Math.max(-32768, Math.min(32767, leftChannel[i + j] * 32768));
                    rightChunk[j] = Math.max(-32768, Math.min(32767, rightChannel[i + j] * 32768));
                }

                let mp3buf;
                if (channels === 1) {
                    mp3buf = mp3encoder.encodeBuffer(leftChunk);
                } else {
                    mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
                }

                if (mp3buf.length > 0) {
                    mp3Data.push(mp3buf);
                }

                processedBlocks++;
                const progress = 10 + (processedBlocks / totalBlocks) * 85;
                
                if (processedBlocks % 100 === 0) {
                    updateProgress(progress);
                    await delay(1);
                }
            }

            const mp3End = mp3encoder.flush();
            if (mp3End.length > 0) {
                mp3Data.push(mp3End);
            }

            progressText.textContent = 'Finalizing...';
            updateProgress(98);

            await delay(200);

            mp3Blob = new Blob(mp3Data, { type: 'audio/mp3' });

            updateProgress(100);
            progressText.textContent = 'Complete!';

            await delay(500);

            showSuccess();

        } catch (error) {
            console.error('Conversion error:', error);
            showNotification('Error during conversion');
            resetApp();
        }
    }

    function showSuccess() {
        progressContainer.classList.add('hidden');
        fileInfo.classList.add('hidden');
        waveformContainer.classList.add('hidden');
        successContainer.classList.remove('hidden');

        originalSize.textContent = formatFileSize(currentFile.size);
        convertedSize.textContent = formatFileSize(mp3Blob.size);
    }

    function updateProgress(percent) {
        progressFill.style.width = `${percent}%`;
        progressPercent.textContent = `${Math.round(percent)}%`;
        
        const progressGlow = document.querySelector('.progress-glow');
        if (progressGlow) {
            progressGlow.style.width = `${percent}%`;
        }
    }

    function resetApp() {
        if (audioContext) {
            audioContext.close().catch(() => {});
            audioContext = null;
        }
        currentFile = null;
        audioBuffer = null;
        mp3Blob = null;
        fileInput.value = '';

        uploadZone.classList.remove('hidden');
        fileInfo.classList.add('hidden');
        waveformContainer.classList.add('hidden');
        progressContainer.classList.add('hidden');
        convertBtn.classList.add('hidden');
        successContainer.classList.add('hidden');

        updateProgress(0);
        progressText.textContent = 'Converting...';
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function showNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(239, 68, 68, 0.9);
            color: white;
            padding: 12px 24px;
            border-radius: 12px;
            font-size: 14px;
            z-index: 1000;
            animation: slideUp 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
});