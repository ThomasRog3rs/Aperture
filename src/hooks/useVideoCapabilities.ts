"use client";

import { useEffect, useMemo, useState } from "react";
import type { RefObject } from "react";
import type { ClientDevice } from "@/components/video-player/types";
import {
  detectClientDevice,
  detectStandaloneWebApp,
  supportsNativeHlsPlayback,
  supportsPictureInPicture,
} from "@/components/video-player/utils";

export function useVideoCapabilities(videoRef: RefObject<HTMLVideoElement | null>) {
  const [supportsNativeHls, setSupportsNativeHls] = useState<boolean | null>(null);
  const [clientDevice, setClientDevice] = useState<ClientDevice>("desktop");
  const [isStandaloneWebApp, setIsStandaloneWebApp] = useState(false);
  const [hasDetectedEnvironment, setHasDetectedEnvironment] = useState(false);
  const [isPipSupported, setIsPipSupported] = useState(false);

  useEffect(() => {
    setSupportsNativeHls(supportsNativeHlsPlayback());
    setClientDevice(detectClientDevice());
    setIsStandaloneWebApp(detectStandaloneWebApp());
    setHasDetectedEnvironment(true);
  }, []);

  useEffect(() => {
    setIsPipSupported(supportsPictureInPicture(videoRef.current));
  }, [videoRef]);

  const shouldAutoEnterFullscreen = useMemo(
    () =>
      hasDetectedEnvironment &&
      !(clientDevice === "mobile" && isStandaloneWebApp),
    [clientDevice, hasDetectedEnvironment, isStandaloneWebApp]
  );

  return {
    supportsNativeHls,
    clientDevice,
    isStandaloneWebApp,
    hasDetectedEnvironment,
    isPipSupported,
    setIsPipSupported,
    shouldAutoEnterFullscreen,
  };
}
