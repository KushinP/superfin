import { requireNativeView } from "expo";
import * as React from "react";
import { useCallback, useImperativeHandle, useRef } from "react";

import {
  MpvPlayerViewProps,
  MpvPlayerViewRef,
  SubtitleStyleConfig,
} from "./MpvPlayer.types";

const NativeView: React.ComponentType<MpvPlayerViewProps & { ref?: any }> =
  requireNativeView("MpvPlayer");

const PIP_LOG = "[PiP] MpvPlayerView.tsx:";

export default React.forwardRef<MpvPlayerViewRef, MpvPlayerViewProps>(
  function MpvPlayerView(props, ref) {
    const nativeRef = useRef<any>(null);
    // The last native view, which React doesn't clear: on unmount React 19
    // nulls nativeRef before the owner's effect cleanups run, so a destroy()
    // from a cleanup reached nothing and the player was left holding its
    // decoder and stream (react19-ref-cleared-before-effect-cleanup).
    const lastNative = useRef<any>(null);
    const setNative = useCallback((view: any) => {
      nativeRef.current = view;
      if (view) lastNative.current = view;
    }, []);

    useImperativeHandle(ref, () => ({
      play: async () => {
        await nativeRef.current?.play();
      },
      pause: async () => {
        await nativeRef.current?.pause();
      },
      destroy: async () => {
        try {
          await (nativeRef.current ?? lastNative.current)?.destroy();
        } catch {
          // The native view may already be gone, released with it.
        }
      },
      seekTo: async (position: number) => {
        await nativeRef.current?.seekTo(position);
      },
      seekBy: async (offset: number) => {
        await nativeRef.current?.seekBy(offset);
      },
      setSpeed: async (speed: number) => {
        await nativeRef.current?.setSpeed(speed);
      },
      getSpeed: async () => {
        return await nativeRef.current?.getSpeed();
      },
      setMute: async (muted: boolean) => {
        await nativeRef.current?.setMute(muted);
      },
      isPaused: async () => {
        return await nativeRef.current?.isPaused();
      },
      getCurrentPosition: async () => {
        return await nativeRef.current?.getCurrentPosition();
      },
      getDuration: async () => {
        return await nativeRef.current?.getDuration();
      },
      startPictureInPicture: async () => {
        console.log(PIP_LOG, "startPictureInPicture → native");
        await nativeRef.current?.startPictureInPicture();
        console.log(PIP_LOG, "startPictureInPicture ← native returned");
      },
      stopPictureInPicture: async () => {
        console.log(PIP_LOG, "stopPictureInPicture → native");
        await nativeRef.current?.stopPictureInPicture();
        console.log(PIP_LOG, "stopPictureInPicture ← native returned");
      },
      isPictureInPictureSupported: async () => {
        const result = await nativeRef.current?.isPictureInPictureSupported();
        console.log(PIP_LOG, "isPictureInPictureSupported =", result);
        return result;
      },
      isPictureInPictureActive: async () => {
        const result = await nativeRef.current?.isPictureInPictureActive();
        console.log(PIP_LOG, "isPictureInPictureActive =", result);
        return result;
      },
      getSubtitleTracks: async () => {
        return await nativeRef.current?.getSubtitleTracks();
      },
      setSubtitleTrack: async (trackId: number) => {
        await nativeRef.current?.setSubtitleTrack(trackId);
      },
      disableSubtitles: async () => {
        await nativeRef.current?.disableSubtitles();
      },
      getCurrentSubtitleTrack: async () => {
        return await nativeRef.current?.getCurrentSubtitleTrack();
      },
      addSubtitleFile: async (url: string, select = true) => {
        await nativeRef.current?.addSubtitleFile(url, select);
      },
      setSubtitlePosition: async (position: number) => {
        await nativeRef.current?.setSubtitlePosition(position);
      },
      setSubtitleScale: async (scale: number) => {
        await nativeRef.current?.setSubtitleScale(scale);
      },
      setSubtitleDelay: async (seconds: number) => {
        await nativeRef.current?.setSubtitleDelay(seconds);
      },
      setSubtitleMarginY: async (margin: number) => {
        await nativeRef.current?.setSubtitleMarginY(margin);
      },
      setSubtitleAlignX: async (alignment: "left" | "center" | "right") => {
        await nativeRef.current?.setSubtitleAlignX(alignment);
      },
      setSubtitleAlignY: async (alignment: "top" | "center" | "bottom") => {
        await nativeRef.current?.setSubtitleAlignY(alignment);
      },
      setSubtitleFontSize: async (size: number) => {
        await nativeRef.current?.setSubtitleFontSize(size);
      },
      setSubtitleStyle: async (style: SubtitleStyleConfig) => {
        await nativeRef.current?.setSubtitleStyle(style);
      },
      setSubtitleBackgroundColor: async (color: string) => {
        await nativeRef.current?.setSubtitleBackgroundColor(color);
      },
      setSubtitleBorderStyle: async (
        style: "outline-and-shadow" | "background-box",
      ) => {
        await nativeRef.current?.setSubtitleBorderStyle(style);
      },
      setSubtitleAssOverride: async (mode: "no" | "force") => {
        await nativeRef.current?.setSubtitleAssOverride(mode);
      },
      // Audio controls
      getAudioTracks: async () => {
        return await nativeRef.current?.getAudioTracks();
      },
      setAudioTrack: async (trackId: number) => {
        await nativeRef.current?.setAudioTrack(trackId);
      },
      getCurrentAudioTrack: async () => {
        return await nativeRef.current?.getCurrentAudioTrack();
      },
      // Video scaling
      setZoomedToFill: async (zoomed: boolean) => {
        await nativeRef.current?.setZoomedToFill(zoomed);
      },
      isZoomedToFill: async () => {
        return await nativeRef.current?.isZoomedToFill();
      },
      // Technical info
      getTechnicalInfo: async () => {
        return await nativeRef.current?.getTechnicalInfo();
      },
    }));

    return <NativeView ref={setNative} {...props} />;
  },
);
