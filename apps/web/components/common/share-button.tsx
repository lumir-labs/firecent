"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import { Check, Share2 } from "lucide-react";

export default function ShareButton({
  url,
  text,
  title,
  files,
}: {
  url: string;
  text: string;
  title: string;
  files?: File[];
}) {
  const [sharing, setSharing] = useState(false);

  function ShareContent() {
    navigator.share({
      title,
      text,
      url,
      files,
    });
    setSharing(true);
    setTimeout(() => {
      setSharing(false);
    }, 1000);
  }
  return (
    <Button onClick={() => ShareContent()} size="icon">
      {sharing ? <Check /> : <Share2 />}
    </Button>
  );
}
