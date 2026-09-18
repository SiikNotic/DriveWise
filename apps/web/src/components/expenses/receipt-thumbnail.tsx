"use client";

import { useEffect, useState } from "react";
import { ReceiptIcon } from "lucide-react";

import { getReceiptSignedUrlAction } from "@/lib/expenses/actions";

/**
 * Receipts live in a private Storage bucket — every view needs a freshly
 * signed, short-lived URL (see getReceiptSignedUrlAction), so this can't be
 * a static <Image>. A plain <img> against that temporary URL is correct
 * here, not a shortcut around Next's image optimizer.
 */
export function ReceiptThumbnail({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getReceiptSignedUrlAction(path).then((signedUrl) => {
      if (!cancelled) setUrl(signedUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!url) {
    return (
      <div className="bg-muted flex size-20 items-center justify-center rounded-md">
        <ReceiptIcon className="text-muted-foreground size-6" aria-hidden="true" />
      </div>
    );
  }

  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element -- temporary signed URL, not a static asset */}
      <img src={url} alt="" className="size-20 rounded-md border object-cover" />
    </a>
  );
}
