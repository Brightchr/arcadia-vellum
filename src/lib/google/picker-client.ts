"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

let pickerLoading: Promise<void> | null = null;

export function loadPickerApi(): Promise<void> {
  if (pickerLoading) return pickerLoading;
  pickerLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.onload = () => {
      window.gapi.load("picker", { callback: () => resolve() });
    };
    script.onerror = () => {
      pickerLoading = null;
      reject(new Error("Failed to load the Google Picker script."));
    };
    document.head.appendChild(script);
  });
  return pickerLoading;
}

export function openDocPicker(opts: {
  accessToken: string;
  apiKey: string;
  projectNumber: string;
  onPicked: (doc: { id: string; name: string }) => void;
}): void {
  const g = window.google;
  const view = new g.picker.DocsView(g.picker.ViewId.DOCUMENTS)
    .setIncludeFolders(true)
    .setOwnedByMe(true);

  const picker = new g.picker.PickerBuilder()
    .addView(view)
    .addView(new g.picker.DocsView(g.picker.ViewId.DOCUMENTS))
    .setOAuthToken(opts.accessToken)
    .setDeveloperKey(opts.apiKey)
    .setAppId(opts.projectNumber)
    .setTitle("Choose your journal document")
    .setCallback((data: any) => {
      if (data.action === g.picker.Action.PICKED && data.docs?.[0]) {
        opts.onPicked({ id: data.docs[0].id, name: data.docs[0].name });
      }
    })
    .build();
  picker.setVisible(true);
}
