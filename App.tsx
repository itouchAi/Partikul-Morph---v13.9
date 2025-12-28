
                  onmessage: async (msg: LiveServerMessage) => {
                      if (msg.toolCall) {
                          for (const fc of msg.toolCall.functionCalls) {
                              let toolResult = { result: "Action executed successfully" };
                              if (fc.name === 'changeColor') { setParticleColor(fc.args.color as string); setUseImageColors(false); } 
                              else if (fc.name === 'changeShape') { setCurrentShape(fc.args.shape as ShapeType); setCurrentText(''); setIsSceneVisible(true); } 
                              else if (fc.name === 'setPreset') { setActivePreset(fc.args.preset as PresetType); } 
                              else if (fc.name === 'controlMusic') { if (fc.args.playing !== undefined) setIsPlaying(!!fc.args.playing); if (fc.args.volume !== undefined) setVolume(Math.max(0, Math.min(1, (fc.args.volume as number) / 100))); } 
                              else if (fc.name === 'controlParticles') { if (fc.args.count) setParticleCount(Math.max(20000, Math.min(60000, fc.args.count as number))); if (fc.args.size) setParticleSize(Math.max(1, Math.min(50, fc.args.size as number))); if (fc.args.density) setModelDensity(Math.max(0, Math.min(100, fc.args.density as number))); } 
                              else if (fc.name === 'controlPhysics') { if (fc.args.strength) setRepulsionStrength(fc.args.strength as number); if (fc.args.radius) setRepulsionRadius(fc.args.radius as number); } 
                              else if (fc.name === 'controlView') { if (fc.args.bgMode) setBgMode(fc.args.bgMode as BackgroundMode); if (fc.args.uiHidden !== undefined) setIsUIHidden(!!fc.args.uiHidden); if (fc.args.autoRotate !== undefined) setIsAutoRotating(!!fc.args.autoRotate); if (fc.args.screensaver) setSsState('active'); } 
                              else if (fc.name === 'controlEffects') { if (fc.args.bloom !== undefined) setEnableBloom(!!fc.args.bloom); if (fc.args.trails !== undefined) setEnableTrails(!!fc.args.trails); if (fc.args.lyrics3D !== undefined) setUseLyricParticles(!!fc.args.lyrics3D); if (fc.args.depth !== undefined) setDepthIntensity(fc.args.depth as number); } 
                              else if (fc.name === 'writeText') { setCurrentText(fc.args.text as string); setIsSceneVisible(true); } 
                              else if (fc.name === 'controlMotion') { setIsMotionControlActive(!!fc.args.active); toolResult = { result: `Motion control is now ${fc.args.active ? 'active' : 'inactive'}.` }; }
                              else if (fc.name === 'getSystemInfo') { const now = new Date(); const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); const dateStr = now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' }); const weatherInfo = await fetchWeatherForAssistant(); toolResult = { result: JSON.stringify({ time: timeStr, date: dateStr, weatherStatus: weatherInfo }) }; }
                              else if (fc.name === 'closeAssistant') {
                                  toolResult = { result: "Asistan kapatılıyor. Görüşmek üzere." };
                                  // Give it a moment to say goodbye then kill it
                                  setTimeout(() => disconnectGeminiLive(), 2000);
                              }
                              else if (fc.name === 'summarizeSong') {
                                  const info = songInfoRef.current;
                                  const currentTitle = audioTitleRef.current || "Bilinmeyen Parça";
                                  
                                  if (info) {
                                       const artist = info.artistName || "Bilinmeyen Sanatçı";
                                       const summary = info.meaningTR || info.meaningEN || "Şarkının analizi mevcut ancak detaylı metin özeti veritabanında eksik.";
                                       const mood = info.mood || "belirsiz";
                                       
                                       // Provide comprehensive context even if meaningTR is missing
                                       toolResult = { 
                                           result: `Şu an çalan şarkı: '${currentTitle}', Sanatçı: ${artist}. Hissiyat: ${mood}. Analiz Özeti: ${summary}` 
                                       };
                                  } else {
                                       toolResult = { result: `Şu an '${currentTitle}' isimli parça çalıyor ancak henüz detaylı yapay zeka analizi yapılmamış veya tamamlanmamış. Kullanıcıdan şarkıyı analiz etmesini iste.` };
                                  }
                              }
                              sessionPromise.then(session => { session.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: toolResult }] }); });
                          }
                      }
                      const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                      if (audioData && liveOutputContextRef.current) {
                          setLiveStatus('speaking');
                          const ctx = liveOutputContextRef.current;
                          if(ctx.state === 'suspended') await ctx.resume();
                          const buffer = await decodeAudioData(base64DecodeAudio(audioData), ctx, 24000);
                          liveNextStartTimeRef.current = Math.max(liveNextStartTimeRef.current, ctx.currentTime);
                          const source = ctx.createBufferSource();
                          source.buffer = buffer;
                          source.connect(ctx.destination);
                          source.addEventListener('ended', () => { liveAudioSourcesRef.current.delete(source); if (liveAudioSourcesRef.current.size === 0) { setLiveStatus('connected'); } });
                          source.start(liveNextStartTimeRef.current);
                          liveNextStartTimeRef.current += buffer.duration;
                          liveAudioSourcesRef.current.add(source);
                      }
                      if (msg.serverContent?.interrupted) { liveAudioSourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} }); liveAudioSourcesRef.current.clear(); liveNextStartTimeRef.current = 0; setLiveStatus('connected'); }
                  },
                  onclose: () => { disconnectGeminiLive(); },
                  onerror: (err) => { console.error("Gemini Live Error", err); setStatus('error', "Bağlantı Hatası"); disconnectGeminiLive(); }
              },
              config: {
                  responseModalities: [Modality.AUDIO],
                  speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
                  tools: toolsDeclarations, 
                  systemInstruction: `Sen 'Partikül Yazı Morfolojisi' deneyiminin asistanısın. Türkçe konuşmalısın. Şarkı analizlerini 'summarizeSong' aracıyla okumalısın. Eğer araçtan analiz verisi dönerse (Artist, Hissiyat, Özet), bunu kullanıcıya doğal bir dille aktar. Kendini kapatman istenirse 'closeAssistant' aracını kullan.` 
              }
          });
          liveSessionRef.current = sessionPromise;
      } catch (e) { console.error("Connection Failed", e); setStatus('error', "Bağlantı Kurulamadı"); disconnectGeminiLive(); }
  };
