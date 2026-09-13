# TENDERWEIGHT · 구조의 무게

Root design and integration contract. Implement this game, not another racing, stealth, rhythm, RPG or deck/shop variant.

## Idea and scope

**Hook: 구조할수록 기우는 배 위에 마을을 짓고, 평형추를 움직여 모두의 균형을 지킨다.** Theme: care has weight. Player fantasy: an original adult rescue engineer, Mira (30), builds a floating village and operates its ballast crane during storms. Original bright sea-glass/coral/yellow art, miniature 3D buildings, little residents and readable physical tilt. No combat or arena. No copied franchise characters.

Candidates compared: a 2.5D ritual fencing game (timing overlaps the preceding rhythm game), a 3D acoustic exploration game (perception overlaps the preceding heist), and this construction/physics rescue game. The latter changes genre, camera, input context, objectives and progression most clearly while offering visible physical consequences and a strong rescue fantasy.

Three authored voyages: build/prepare -> storm -> repair/prepare -> next storm -> safe harbor. Each resets budget and boat, unlocks the next on victory and keeps separate standard/gentle records. Flooding or sustained capsize loses the current voyage; retry starts the voyage. No attempt autosave, only completed records/settings. Target 5–10 minutes of active storm play plus construction across all voyages.

Preparation is a spatial building game. Storms are an active WASD balance game. The two parts must affect each other through mass, buoyancy, shelter capacity and pumping. No separate minigame disconnected from the boat.

## World coordinates and controls

6×6 deck, CELL=1.8m; center x=(col-2.5)*CELL, z=(row-2.5)*CELL. Deck extends ±5.4m. +X is screen right; -Z is away/up the deck. Fixed elevated frontal camera at roughly (0,15,19), looking at origin. Do not add camera orbit or an axis reflection workaround. True Three.js 3D scene.

Roll positive means +X edge DOWN: boat.rotation.z = -roll. Pitch positive means +Z edge DOWN: boat.rotation.x = pitch. Boat root position.y is computed freeboard. All deck objects and people inherit the same transform. Sea stays world-horizontal. Scene never changes simulation state.

Preparation: arrows/WASD move a grid cursor; 1/2/3 choose pontoon/cabin/pump; Space places; Backspace removes; Enter launches the next storm. Mouse ray-picks deck cells, left click places the current tool, right click removes. Construction only during preparation. Cursor feedback shows cost/type and occupied/affordability results. Deletion refunds full cost in preparation, including structures paid for earlier; starter structures may be removed/refunded consistently, no duplicate-refund exploit.

Storm: WASD/arrows continuously move the overhead ballast tank in X/Z. Shift halves speed for fine trim. Tank x/z are bounded ±3.6m; default speed3.0m/s. The tank is on gantry rails above roofs, so it can cross the entire working area without going through buildings. Move weight toward the HIGH edge to oppose tilt. Space has no storm action. Esc pauses; M mutes; Enter starts/continues/retries, R retries defeat.

Touch: four directional holds (build cursor steps, storm tank continuous), 3 tool buttons, place/remove and launch as appropriate to phase. Independent pointer IDs, true multi-touch, no stuck actions. Targets≥44px at390×844 and844×390, gameplay view preserved. Help must match touch versus keyboard. No automatic pointer lock.

## Structures and starter boat

Exports BUILDINGS keyed `pontoon`, `cabin`, `pump` with id,name,cost,mass,lift,capacity,description:

| Type | Korean | Cost | Mass | Lift | Shelter |
|---|---|---:|---:|---:|---:|
| pontoon | 부력통 | 3 | .35 | 2.4 | 0 |
| cabin | 쉼터 | 4 | 2.4 | 0 | 6 |
| pump | 배수기 | 4 | 1.2 | 0 | 0 |

One structure per cell. Cabins with assigned residents cannot be removed; explain why and do not refund. Pontoons and pumps are under-deck devices; shelters are raised on narrow corner stilts with floor≥.65m and roof<2.3m relative to deck. Residents are small stylized figures ≤.5m tall and may walk underneath the raised shelters. Thus the whole deck remains traversable. Gantry tank bottom>3.0m, no roof collision. Shelters have warm occupied windows and visible capacity cues.

Each starter: pontoons at [0,0],[5,0],[0,5],[5,5]; cabins at [1,2],[4,3]; no pump. Base raft mass12, ballast mass6, base buoyancy26. All these constants live in exported TUNING, not duplicated in the scene/app. Every rescued resident adds .55 mass at their current x/z. Flood adds10*water mass at center. Model the ballast tank, rails, pontoons, cabins and pumps as genuine meshes.

## Voyages (exact content)

1. `first-rescue` / 작은 무게부터 / budget12 / total10 residents.
   Stages:35s force{ x:12,z:3 }, arrivals5 from west;40s force{x:-17,z:5}, arrivals5 from east.
   Intro: 처음에는 작은 움직임이면 충분합니다. 뜬 쪽으로 평형추를 옮기세요.
2. `cross-current` / 서로 다른 방향 / budget24 / total18.
   Stages:40s force{x:20,z:-9}, arrivals6 north;40s force{x:-22,z:14}, arrivals6 east;45s force{x:16,z:20}, arrivals6 south.
   Intro: 사람과 바람은 같은 쪽에서 오지 않습니다. 쉼터의 자리도 무게입니다.
3. `last-harbor` / 모두를 위한 항구 / budget34 / total24.
   Stages:45s force{x:24,z:14}, arrivals8 west;45s force{x:-27,z:18}, arrivals8 south;50s force{x:22,z:-26}, arrivals8 east.
   Intro: 마지막 항구까지 한 사람도 두고 가지 않습니다.

Arrival times per stage: evenly from t=6 to t=duration-10. Spawn person at source edge x/z±5.0, other coordinate chosen deterministic spread within±2.7. Assign to the nearest cabin with remaining capacity (including already assigned/in transit). Walk in a straight path at1.2m/s on the fully traversable deck, then mark settled. People remain at their assigned cabin for mass calculations after settling. `rescued` increases at boarding, not settlement. No spawning people beyond cabin capacity; preflight blocks launching unless total cabin capacity covers the FULL voyage target and supplies a clear Korean reason. Each resident has stable id and cabinId.

At stage completion, settle remaining walkers, increment stageIndex to the NEXT stage before entering preparation, preserve structures/residents/tank and budget, reduce water by .2, grant4 wood, reset angular velocities/angles for a quiet repair phase. UI states the next stage's direction and arrival count before launch. After the last stage, win only if rescued===voyage.total. Do not require an invisible extra input to finish.

## Physics and failure

Pure deterministic fixed-step simulation, app fixed1/60, engine substeps≤1/60. Clamp only dt and input; preserve finite state. Non-playing/paused app does not advance engine. Engine methods mutate a private run, inspection always copies it.

momentX = sum(structure.mass*x - structure.lift*x) + sum(resident.mass*x) + 6*tank.x. Same for momentZ. Raft/flood mass is centered. buoyancy=26+sum(lift); totalMass=12+6+structureMass+residentMass+10*water.

freeboard=clamp(.52+(buoyancy-totalMass)*.015,.12,.75).

Each stage's gust is smooth and readable: main force*(.65+.35*sin(t*.45)) plus a small sine ripple (x amplitude2, z amplitude1, distinct phase). Stage `force` is the published prevailing direction. Gentle multiplies wind by.7 and flood gain by.65.

angularAccelerationX = .035*(momentX+wind.x) -3.2*roll -2.6*rollVelocity. Same for pitch/momentZ. Integrate velocity then angle. These coefficients are in TUNING. Wind must be sampled once at simulation time so rendering doesn't change gameplay.

swell=.06+.06*sin(stageTime*.9); clearance=freeboard-5.4*abs(roll)-5.4*abs(pitch)-swell.
water += [max(0,-clearance)*.035*(gentle?.65:1) -.003 -.007*pumpCount*max(.15,1-(abs(roll)+abs(pitch))/.8)]*dt; clamp0..1.
Capsize exposure accumulates when max(abs(roll),abs(pitch))>.55, otherwise decays at2sec/sec; >=2sec loses. water>=1 loses. Display both tilt danger and water so failure is never unexplained.

Statistics: rescued, peakWater, peakTilt, stormTime, structureCount; grade S water<.25 and peakTilt<.3, A water<.65, B otherwise on win. No grade on loss.

Root may tune numbers after measured playtests. Executors report infeasible/boring cases and do not redesign controls, rules or voyages silently. Required: demonstrate a legal standard-mode build and ballast controller can finish all voyages, and genuinely poor trim can flood/capsize.

## Module/API contract

Core owns `src/game.js`, `src/voyages.js`, `tests/game.test.mjs` only. voyages exports VOYAGES,getVoyage,BUILDINGS,TUNING,cellToWorld(col,row),worldToCell(x,z). TUNING includes all shared dimensions/masses/constants. Definition fields use id,title,intro,budget,total,stages[{duration,force:{x,z},count,side}].

game exports createRun(voyageId='first-rescue',mode='standard'),placeBuilding(run,type,col,row),removeBuilding(run,col,row),launchStage(run),stepRun(run,input,dt),summarize(run),preflight(run),metrics(run).

Run: {voyageId,mode,status:'prepare'|'storm'|'won'|'lost',stageIndex,stageTime,time,budget,structures:[{id,type,col,row,x,z}],residents:[{id,x,z,cabinId,settled}],tank:{x,z},roll,pitch,rollVelocity,pitchVelocity,water,freeboard,wind:{x,z},capsizeTime,rescued,events:[],stats:{peakWater,peakTilt,stormTime}}. Extra PRIVATE fields allowed. Actions return events arrays, replace run.events; step likewise. Event types placed,removed,denied,launch,arrival,stage-clear,win,lose with id/type/text/reason as appropriate. Idempotent terminal behavior. preflight returns {ok,reason,capacity,required}; metrics returns mass,buoyancy,momentX,momentZ,pumps,capacity. Summarize returns voyageId,mode,status,rescued,total,water,peakWater,peakTilt,stormTime,grade.

step input{x,z,fine} normalized axes [-1,1], diagonal speed normalized. Preparation never moves the ballast; placement APIs reject storm/finished mutations. No DOM/audio/Three imports in core. Unknown structure/voyage ids reject safely. No randomness necessary.

Presentation owns `src/models.js`,`src/scene.js`,`src/audio.js`. createScene(container)->{setVoyage(voyage),update(run,dt,cursor),pick(clientX,clientY),resize(),dispose(),get stats()}. Cursor {col,row,type,valid} or null; pick returns{col,row} or null. Scene visualizes latest structures without rebuilding the whole boat every frame; dispose removals/level changes. `stats` copy-only includes drawCalls,triangles,pixels,software,frames,structureCount,residentCount,boatRoll,boatPitch,tankPosition,seaLevel. Root supplies key art assets/key-art.webp. No runtime external textures. Software pixel budget~400k no shadows; hardware~2M and restrained shadows. Daylight sea-glass ocean/coral/yellow homes, white sky, subtle waves/foam/sun highlights. Original miniature engineer/resident models; avoid a plain dark cube scene.

createAudio()->{unlock,setVolume,setMuted,start,pause,resume,stop,play,update,dispose}. Original sea/wind ambience and warm plucked musical motifs; short placement/error/arrival/stage-clear/win/lose cues, audible tilt/flood warnings, no clipped/repeated events, graceful unavailable audio. User-gesture unlock, preserve volume0.

App owns index.html,style.css,src/app.js. Screen ids title,select,play,pause,guide,defeat,clear,ending; `play` contains both preparation and storm based on run.status. Korean UI. Keep canvas the main view; compact build toolbar, capacity/budget/current storm, water, tilt and rescue objective. Big readable phase transition, clear next storm preview, lost cause/retry. HUD interactive elements need explicit pointer events. Input listeners MUST be registered. Aggregate events across fixed steps, preserve mouse/touch/key semantics. Pause/hidden/blur clears held inputs and freezes time/audio. Do not leave saved run accidentally resuming from stale menus.

Selectors [data-action='start'|'begin'|'launch'|'resume'|'next'|'retry'|'guide'|'back'|'place'|'remove'], [data-voyage-id], [data-tool='pontoon'|'cabin'|'pump'], [data-touch='left'|'right'|'up'|'down'|'fine']; #mode-select,#volume-range, canvas inside#world. Root tests rely on these selectors. Read-only window.__tender getters ready,screen,run(deep clone),settings,records,sceneStats,cursor. Keys tenderweight-records-v1,tenderweight-settings-v1. Record map mode->voyageId->{grade,peakWater,peakTilt,stormTime,rescued}; validate known fields/types. Unlock next through either mode, mode-specific best record by lower peakWater then time. Defaults volume.24,mutedfalse,modestandard.

Root owns tooling, artwork, docs, integration, browser/campaign/package tests and all Git operations. Final acceptance: actual keyboard construction plus storm control through all3 voyages/52 residents, actual loss/retry, touch and mouse placement, file/subpath/audio/404 checks, visual geometry and performance checks, portable ZIP, meaningful commits. Publishing waits for per-push approval.
