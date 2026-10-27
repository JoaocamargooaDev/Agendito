"use client";

import { useEffect } from "react";

const selector = "[data-content-reveal]";

export function ContentRevealRuntime() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;

    const seen = new WeakSet<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || seen.has(entry.target)) continue;
        const element = entry.target as HTMLElement;
        const delay = Number(element.dataset.revealDelay);
        element.style.setProperty("--ag-reveal-delay", `${Number.isFinite(delay) ? Math.min(60, Math.max(0, delay)) : 0}ms`);
        element.dataset.revealed = "true";
        seen.add(element);
        observer.unobserve(element);
      }
    }, { threshold: 0.12, rootMargin: "0px 0px -24px 0px" });

    const observeTree = (node: Node) => {
      if (!(node instanceof Element)) return;
      if (node.matches(selector) && !seen.has(node)) observer.observe(node);
      node.querySelectorAll(selector).forEach((element) => {
        if (!seen.has(element)) observer.observe(element);
      });
    };

    document.querySelectorAll(selector).forEach((element) => observer.observe(element));
    const mutations = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach(observeTree));
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutations.disconnect();
      observer.disconnect();
    };
  }, []);

  return null;
}
