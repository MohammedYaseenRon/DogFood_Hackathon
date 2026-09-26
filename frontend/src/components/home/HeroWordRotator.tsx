"use client";

import { useEffect, useState } from "react";

const WORDS = ["teams", "judges", "organizers", "builders", "hackathons"];

export function HeroWordRotator() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % WORDS.length);
        setVisible(true);
      }, 300);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <span
      className={`inline-block bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      {WORDS[index]}
    </span>
  );
}
