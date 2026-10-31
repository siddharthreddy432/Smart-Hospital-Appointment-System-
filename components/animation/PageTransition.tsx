'use client';

import React from 'react';
import { usePageTransition } from './PageTransitionProvider';
import { useScrollReveal } from './useScrollReveal';
import { usePathname } from 'next/navigation';

export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { stageRef, curtainRef, curtainLabelRef, activeSceneMeta } =
    usePageTransition();

  useScrollReveal(stageRef, [pathname]);

  return (
    <div className="relative flex-1 flex flex-col">
      {/* Subtle Architectural Scene Curtain (matches 00:02 & 00:06 horizontal split wipe in TRANSITION.mp4, adapted to SAHS palette) */}
      <div
        ref={curtainRef}
        data-gsap="scene-curtain"
        aria-hidden="true"
        style={{ display: 'none' }}
        className="fixed inset-x-0 top-[57px] bottom-0 z-20 pointer-events-none bg-[#FAFAF8] border-y-2 border-[#263238] flex items-center justify-center overflow-hidden"
      >
        {/* Subtle Ambient Background Lines */}
        <div className="absolute inset-0 pointer-events-none opacity-35 bg-[radial-gradient(#0F766E_1px,transparent_1px)] [background-size:24px_24px]" />

        <div
          ref={curtainLabelRef}
          className="relative z-10 px-5 py-3 rounded-xl bg-white border border-[#263238] shadow-[3px_3px_0px_#263238] flex items-center gap-3"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-[#0F766E]" />
          <div className="text-left">
            <span className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#0F766E]">
              {activeSceneMeta.accentTag}
            </span>
            <span className="block text-sm font-extrabold text-[#17211F]">
              {activeSceneMeta.sceneTitle}
            </span>
          </div>
        </div>
      </div>

      {/* Main Animated Scene Stage */}
      <main
        ref={stageRef}
        data-gsap="page-stage"
        data-scene={activeSceneMeta.href}
        className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-7"
      >
        {children}
      </main>
    </div>
  );
}
