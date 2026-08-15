import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Settings, X, ChevronLeft, ChevronRight, Guitar, Music } from 'lucide-react';
import pitchy from 'pitchy';

const GUITAR_STRINGS = [
  { note: 'E2', name: '6ª (E)', frequency: 82.41, color: '#ff6b6b' },
  { note: 'A2', name: '5ª (A)', frequency: 110.00, color: '#ffa500' },
  { note: 'D3', name: '4ª (D)', frequency: 146.83, color: '#ffeb3b' },
  { note: 'G3', name: '3ª (G)', frequency: 196.00, color: '#4ecdc4' },
  { note: 'B3', name: '2ª (B)', frequency: 246.94, color: '#a29bfe' },
  { note: 'E4', name: '1ª (E)', frequency: 329.63, color: '#fd79a8' },
];

const BASS_STRINGS = [
  { note: 'B0', name: '5ª (B)', frequency: 30.87, color: '#ff6b6b' },
  { note: 'E1', name: '4ª (E)', frequency: 41.20, color: '#ffa500' },
  { note: 'A1', name: '3ª (A)', frequency: 55.00, color: '#ffeb3b' },
  { note: 'D2', name: '2ª (D)', frequency: 73.42, color: '#4ecdc4' },
  { note: 'G2', name: '1ª (G)', frequency: 98.00, color: '#a29bfe' },
];

const STANDARD_TUNINGS = {
  guitar: GUITAR_STRINGS,
  bass: BASS_STRINGS,
};

export function Tuner({ onClose, defaultInstrument = 'guitar' }) {
  const [instrument, setInstrument] = useState(defaultInstrument);
  const [isListening, setIsListening] = useState(false);
  const [detectedNote, setDetectedNote] = useState(null);
  const [detectedFreq, setDetectedFreq] = useState(0);
  const [targetString, setTargetString] = useState(0);
  const [audioContext, setAudioContext] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [noiseLevel, setNoiseLevel] = useState(0);
  
  const mediaStreamRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const animationRef = useRef(null);
  const pitchDetectorRef = useRef(null);

  const strings = STANDARD_TUNINGS[instrument];
  const targetNote = strings[targetString];

  // Initialize audio context
  const initAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100,
        } 
      });
      
      mediaStreamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
      setAudioContext(ctx);
      
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.3;
      analyserRef.current = analyser;
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      dataArrayRef.current = dataArray;
      
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      
      pitchDetectorRef.current = pitchy;
      setPermissionDenied(false);
      
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setPermissionDenied(true);
    }
  }, []);

  const stopListening = useCallback(() => {
    setIsListening(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContext) {
      audioContext.close();
      setAudioContext(null);
    }
  }, [audioContext]);

  const startListening = useCallback(() => {
    if (!audioContext) {
      initAudio().then(() => {
        if (audioContext) startDetection();
      });
    } else {
      startDetection();
    }
  }, [audioContext, initAudio]);

  const startDetection = useCallback(() => {
    setIsListening(true);
    detectPitch();
  }, []);

  const detectPitch = useCallback(() => {
    if (!isListening || !analyserRef.current || !dataArrayRef.current) return;

    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;
    
    analyser.getByteTimeDomainData(dataArray);
    
    // Calculate RMS for noise level
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const val = (dataArray[i] - 128) / 128;
      sum += val * val;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    setNoiseLevel(rms);

    // Convert to Float32Array for pitchy
    const buffer = new Float32Array(dataArray.length);
    for (let i = 0; i < dataArray.length; i++) {
      buffer[i] = (dataArray[i] - 128) / 128;
    }

    try {
      const [pitch, clarity] = pitchy.detectPitch(buffer, 44100);
      
      if (clarity > 0.3 && pitch > 20 && pitch < 2000) {
        setDetectedFreq(pitch);
        
        // Find closest note
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const noteNumber = Math.round(12 * Math.log2(pitch / 440) + 69);
        const noteName = noteNames[noteNumber % 12];
        const octave = Math.floor(noteNumber / 12) - 1;
        const cents = 1200 * Math.log2(pitch / (440 * Math.pow(2, (noteNumber - 69) / 12)));
        
        setDetectedNote({
          name: noteName,
          octave,
          freq: pitch,
          cents: Math.round(cents),
          clarity,
          noteNumber,
        });
      }
    } catch (e) {
      console.error('Pitch detection error:', e);
    }

    if (isListening) {
      animationRef.current = requestAnimationFrame(detectPitch);
    }
  }, [isListening]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioContext) audioContext.close();
    };
  }, [audioContext]);

  // Auto-detect target string
  useEffect(() => {
    if (detectedNote && targetNote) {
      const targetFreq = targetNote.frequency;
      const diff = Math.abs(detectedFreq - targetFreq);
      if (diff < 50) { // Close enough to target
        // Could auto-advance to next string
      }
    }
  }, [detectedNote, targetNote]);

  // Calculate cents difference
  const getCentsDiff = (detected, target) => {
    if (!detected || !target) return 0;
    return 1200 * Math.log2(detected / target.frequency);
  };

  const centsDiff = getCentsDiff(detectedFreq, targetNote);

  if (permissionDenied) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4">
        <div className="bg-panel rounded-2xl max-w-md w-full p-6 text-center">
          <h2 className="text-xl font-bold text-white mb-4">Permiso de micrófono requerido</h2>
          <p className="text-gray-400 mb-6">El afinador necesita acceso al micrófono para detectar el tono de tu instrumento.</p>
          <button 
            onClick={initAudio}
            className="bg-amber-400 text-black px-6 py-3 rounded-xl font-bold hover:bg-amber-500"
          >
            Permitir micrófono
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-panel">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white">
            <X size={24} />
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setInstrument(instrument === 'guitar' ? 'bass' : 'guitar')}
              className="p-2 bg-gray-800 rounded-xl text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            >
              {instrument === 'guitar' ? <Music size={24} /> : <Guitar size={24} />}
            </button>
            <h2 className="text-xl font-bold text-white">
              {instrument === 'guitar' ? 'Afinador de Guitarra' : 'Afinador de Bajo (5 cuerdas)'}
            </h2>
          </div>
          <button 
            onClick={isListening ? stopListening : startListening}
            className={`p-2 rounded-xl transition-colors ${isListening 
              ? 'bg-red-500 text-white' 
              : 'bg-green-500 text-white'}`}
          >
            {isListening ? <MicOff size={24} /> : <Mic size={24} />}
          </button>
        </div>

        {/* Noise Level Indicator */}
        <div className="px-4 py-2 border-b border-gray-700 bg-panel/50">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-400 transition-all duration-100"
                style={{ width: `${Math.min(noiseLevel * 100, 100)}%` }}
              />
            </div>
            <span className="text-xs text-gray-400 w-16 text-right">
              {noiseLevel > 0.01 ? 'Ruido detectado' : 'Silencio'}
            </span>
          </div>
        </div>

        {/* Target String Selector */}
        <div className="px-4 py-3 border-b border-gray-700 bg-panel/50">
          <div className="flex items-center justify-center gap-1 overflow-x-auto pb-2">
            {strings.map((string, index) => (
              <button
                key={string.note}
                onClick={() => setTargetString(index)}
                className={`px-3 py-2 rounded-lg text-sm font-mono transition-all ${
                  index === targetString
                    ? 'bg-amber-400 text-black font-bold'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {string.name}
                <br />
                <span className="text-xs">{string.frequency.toFixed(1)}Hz</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Tuner Display */}
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          {/* Target Note Display */}
          <div className="mb-8">
            <div className="text-xs text-gray-500 mb-1">Cuerda objetivo</div>
            <div className="flex items-baseline gap-2">
              <span className="text-7xl md:text-9xl font-bold font-mono text-white">
                {targetNote?.note.replace(/[0-9]/g, '') || '--'}
              </div>
              <div className="text-2xl text-gray-400 font-mono">
                {targetNote?.note.match(/\d+/) || ''}
              </div>
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {targetNote ? `${targetNote.name} • ${targetNote.frequency.toFixed(1)} Hz` : ''}
            </div>
          </div>

          {/* Detected Note Display */}
          <div className="mb-8">
            <div className="text-xs text-gray-500 mb-1">Detectado</div>
            {detectedNote ? (
              <div className="flex items-baseline gap-2">
                <span className="text-5xl md:text-7xl font-bold font-mono text-amber-400">
                  {detectedNote.name}
                </div>
                <div className="text-lg text-gray-400 font-mono">
                  {detectedNote.octave}
                </div>
              </div>
            ) : (
              <div className="text-5xl text-gray-700">--</div>
            )}
            {detectedNote && (
              <div className="text-sm text-gray-500 mt-1">
                {detectedFreq.toFixed(1)} Hz • {detectedNote.cents > 0 ? '+' : ''}{detectedNote.cents} cents
              </div>
            )}
          </div>

          {/* Tuning Meter */}
          <div className="w-full max-w-md">
            <div className="relative h-8 bg-gray-800 rounded-full overflow-hidden mb-2">
              {/* Center line */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-amber-400" style={{ transform: 'translateX(-50%)' }} />
              
              {/* Cents markers */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-600" style={{ transform: 'translateX(-50%) translateX(-50%)' } />
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-600" style={{ transform: 'translateX(-50%) translateX(50%)' } />
              
              {/* Needle */}
              <div 
                className="absolute top-0 bottom-0 w-px bg-amber-400 transition-all duration-200"
                style={{ 
                  left: '50%', 
                  transform: `translateX(-50%) translateX(${Math.max(-50, Math.min(50, centsDiff / 2))}%)`,
                  background: centsDiff > 10 ? '#ef4444' : centsDiff < -10 ? '#3b82f6' : '#fbbf24'
                } 
              />
            </div>
            
            {/* Cents labels */}
            <div className="flex justify-between text-xs text-gray-500 px-2">
              <span>-50</span>
              <span className="text-amber-400 font-bold">0</span>
              <span>+50</span>
            </div>

            {/* Status Text */}
            <div className="text-center mt-4">
              {Math.abs(centsDiff) < 2 ? (
                <p className="text-green-400 text-lg font-bold">✓ ¡Afinado!</p>
              ) : centsDiff > 0 ? (
                <p className="text-blue-400 text-lg font-bold">♭ Demasiado agudo - Afloja la cuerda</p>
              ) : (
                <p className="text-red-400 text-lg font-bold">♯ Demasiado grave - Tensa la cuerda</p>
              )}
            </div>
          </div>

        {/* Quick String Buttons */}
        <div className="p-4 border-t border-gray-700 bg-panel/50">
          <div className="flex flex-wrap justify-center gap-2">
            {strings.map((string, index) => (
              <button
                key={string.note}
                onClick={() => setTargetString(index)}
                className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
                  index === targetString
                    ? 'bg-amber-400 text-black font-bold'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {string.name}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Tuner;