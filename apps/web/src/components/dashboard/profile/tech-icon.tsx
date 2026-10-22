"use client";

import React, { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

// Brand / Tool Icons from react-icons/si
import {
  SiReact,
  SiNextdotjs,
  SiTypescript,
  SiJavascript,
  SiNodedotjs,
  SiPython,
  SiTailwindcss,
  SiPostgresql,
  SiDocker,
  SiFigma,
  SiGraphql,
  SiMongodb,
  SiGit,
  SiGithub,
  SiVuedotjs,
  SiGo,
  SiRust,
  SiFlutter,
  SiSwift,
  SiKotlin,
  SiPrisma,
  SiSupabase,
  SiRedis,
  SiKubernetes,
  SiLinux,
  SiHtml5,
  SiCss,
  SiCplusplus,
  SiPhp,
  SiRuby,
  SiRubyonrails,
  SiLaravel,
  SiDjango,
  SiFlask,
  SiExpress,
  SiSpringboot,
  SiFirebase,
  SiMysql,
  SiAngular,
  SiSvelte,
  SiVite,
  SiWebpack,
  SiTerraform,
  SiNginx,
  SiStripe,
  SiClerk,
  SiVercel,
  SiGooglecloud,
  SiPostman,
} from "react-icons/si";

// Role / Domain Icons from react-icons/fa6
import {
  FaShieldHalved,
  FaBrain,
  FaLaptopCode,
  FaServer,
  FaMobileScreen,
  FaCode,
  FaCloud,
  FaPenRuler,
  FaDatabase,
  FaRobot,
  FaBug,
  FaCube,
  FaAws,
} from "react-icons/fa6";

import { Code2 } from "@/components/animated-icons";

interface TechIconProps {
  name: string;
  className?: string;
}

export function TechIcon({ name, className = "w-3.5 h-3.5" }: TechIconProps) {
  const norm = useMemo(() => name.toLowerCase().trim(), [name]);
  const [imgFailed, setImgFailed] = useState(false);

  // 1. Check Roles & Specializations (Frontend, Backend, Cyber Security, AI Engineer...)
  if (
    norm.includes("cyber") ||
    norm.includes("security") ||
    norm.includes("pentest") ||
    norm.includes("infosec")
  ) {
    return <FaShieldHalved className={cn("text-emerald-400 shrink-0", className)} />;
  }

  if (
    norm.includes("ai engineer") ||
    norm.includes("ai / ml") ||
    norm.includes("ai/ml") ||
    norm.includes("machine learning") ||
    norm.includes("deep learning") ||
    norm.includes("data scientist") ||
    norm.includes("llm") ||
    norm === "ai"
  ) {
    return <FaBrain className={cn("text-purple-400 shrink-0", className)} />;
  }

  if (
    norm.includes("frontend") ||
    norm.includes("front end") ||
    norm.includes("front-end") ||
    norm.includes("web developer") ||
    norm.includes("ui engineer")
  ) {
    return <FaLaptopCode className={cn("text-cyan-400 shrink-0", className)} />;
  }

  if (
    norm.includes("backend") ||
    norm.includes("back end") ||
    norm.includes("back-end") ||
    norm.includes("api engineer")
  ) {
    return <FaServer className={cn("text-amber-400 shrink-0", className)} />;
  }

  if (norm.includes("full stack") || norm.includes("fullstack")) {
    return <FaCode className={cn("text-blue-400 shrink-0", className)} />;
  }

  if (
    norm.includes("mobile") ||
    norm.includes("ios") ||
    norm.includes("android") ||
    norm.includes("app developer")
  ) {
    return <FaMobileScreen className={cn("text-green-400 shrink-0", className)} />;
  }

  if (
    norm.includes("devops") ||
    norm.includes("cloud") ||
    norm.includes("sre") ||
    norm.includes("infrastructure")
  ) {
    return <FaCloud className={cn("text-sky-400 shrink-0", className)} />;
  }

  if (
    norm.includes("ui/ux") ||
    norm.includes("product design") ||
    norm.includes("designer") ||
    norm.includes("graphic")
  ) {
    return <FaPenRuler className={cn("text-pink-400 shrink-0", className)} />;
  }

  if (norm.includes("data engineer") || norm.includes("dba")) {
    return <FaDatabase className={cn("text-blue-400 shrink-0", className)} />;
  }

  if (norm.includes("automation") || norm.includes("robotics") || norm.includes("bot")) {
    return <FaRobot className={cn("text-teal-400 shrink-0", className)} />;
  }

  if (norm.includes("qa") || norm.includes("test") || norm.includes("quality")) {
    return <FaBug className={cn("text-rose-400 shrink-0", className)} />;
  }

  if (norm.includes("blockchain") || norm.includes("web3") || norm.includes("crypto")) {
    return <FaCube className={cn("text-indigo-400 shrink-0", className)} />;
  }

  // 2. Check Tool / Language / Framework specific mappings
  const key = norm.replace(/[^a-z0-9]/g, "");

  switch (key) {
    case "react":
    case "reactjs":
    case "reactnative":
      return <SiReact className={cn("text-[#61DAFB] shrink-0", className)} />;
    case "next":
    case "nextjs":
    case "nextdotjs":
      return <SiNextdotjs className={cn("text-fg shrink-0", className)} />;
    case "typescript":
    case "ts":
      return <SiTypescript className={cn("text-[#3178C6] shrink-0", className)} />;
    case "javascript":
    case "js":
      return <SiJavascript className={cn("text-[#F7DF1E] shrink-0", className)} />;
    case "node":
    case "nodejs":
    case "nodedotjs":
      return <SiNodedotjs className={cn("text-[#5FA04E] shrink-0", className)} />;
    case "python":
    case "py":
      return <SiPython className={cn("text-[#3776AB] shrink-0", className)} />;
    case "tailwind":
    case "tailwindcss":
      return <SiTailwindcss className={cn("text-[#06B6D4] shrink-0", className)} />;
    case "postgresql":
    case "postgres":
      return <SiPostgresql className={cn("text-[#4169E1] shrink-0", className)} />;
    case "docker":
      return <SiDocker className={cn("text-[#2496ED] shrink-0", className)} />;
    case "aws":
    case "amazonwebservices":
      return <FaAws className={cn("text-[#FF9900] shrink-0", className)} />;
    case "figma":
      return <SiFigma className={cn("text-[#F24E1E] shrink-0", className)} />;
    case "graphql":
      return <SiGraphql className={cn("text-[#E10098] shrink-0", className)} />;
    case "mongodb":
    case "mongo":
      return <SiMongodb className={cn("text-[#47A248] shrink-0", className)} />;
    case "git":
      return <SiGit className={cn("text-[#F05032] shrink-0", className)} />;
    case "github":
      return <SiGithub className={cn("text-fg shrink-0", className)} />;
    case "vue":
    case "vuejs":
    case "vuedotjs":
      return <SiVuedotjs className={cn("text-[#41B883] shrink-0", className)} />;
    case "go":
    case "golang":
      return <SiGo className={cn("text-[#00ADD8] shrink-0", className)} />;
    case "rust":
      return <SiRust className={cn("text-[#DEA584] shrink-0", className)} />;
    case "flutter":
      return <SiFlutter className={cn("text-[#02569B] shrink-0", className)} />;
    case "swift":
      return <SiSwift className={cn("text-[#F05138] shrink-0", className)} />;
    case "kotlin":
      return <SiKotlin className={cn("text-[#7F52FF] shrink-0", className)} />;
    case "prisma":
      return <SiPrisma className={cn("text-[#5A67D8] shrink-0", className)} />;
    case "supabase":
      return <SiSupabase className={cn("text-[#3ECF8E] shrink-0", className)} />;
    case "redis":
      return <SiRedis className={cn("text-[#DC382D] shrink-0", className)} />;
    case "kubernetes":
    case "k8s":
      return <SiKubernetes className={cn("text-[#326CE5] shrink-0", className)} />;
    case "linux":
      return <SiLinux className={cn("text-[#FCC624] shrink-0", className)} />;
    case "html":
    case "html5":
      return <SiHtml5 className={cn("text-[#E34F26] shrink-0", className)} />;
    case "css":
    case "css3":
      return <SiCss className={cn("text-[#1572B6] shrink-0", className)} />;
    case "cpp":
    case "cplusplus":
      return <SiCplusplus className={cn("text-[#00599C] shrink-0", className)} />;
    case "php":
      return <SiPhp className={cn("text-[#777BB4] shrink-0", className)} />;
    case "ruby":
      return <SiRuby className={cn("text-[#CC342D] shrink-0", className)} />;
    case "rails":
    case "rubyonrails":
      return <SiRubyonrails className={cn("text-[#CC0000] shrink-0", className)} />;
    case "laravel":
      return <SiLaravel className={cn("text-[#FF2D20] shrink-0", className)} />;
    case "django":
      return <SiDjango className={cn("text-[#092E20] shrink-0", className)} />;
    case "flask":
      return <SiFlask className={cn("text-fg shrink-0", className)} />;
    case "express":
    case "expressjs":
      return <SiExpress className={cn("text-fg shrink-0", className)} />;
    case "springboot":
    case "spring":
      return <SiSpringboot className={cn("text-[#6DB33F] shrink-0", className)} />;
    case "firebase":
      return <SiFirebase className={cn("text-[#FFCA28] shrink-0", className)} />;
    case "mysql":
      return <SiMysql className={cn("text-[#4479A1] shrink-0", className)} />;
    case "angular":
    case "angularjs":
      return <SiAngular className={cn("text-[#DD0031] shrink-0", className)} />;
    case "svelte":
      return <SiSvelte className={cn("text-[#FF3E00] shrink-0", className)} />;
    case "vite":
      return <SiVite className={cn("text-[#646CFF] shrink-0", className)} />;
    case "webpack":
      return <SiWebpack className={cn("text-[#8DD6F9] shrink-0", className)} />;
    case "terraform":
      return <SiTerraform className={cn("text-[#844FBA] shrink-0", className)} />;
    case "nginx":
      return <SiNginx className={cn("text-[#009639] shrink-0", className)} />;
    case "stripe":
      return <SiStripe className={cn("text-[#635BFF] shrink-0", className)} />;
    case "clerk":
      return <SiClerk className={cn("text-[#6C47FF] shrink-0", className)} />;
    case "vercel":
      return <SiVercel className={cn("text-fg shrink-0", className)} />;
    case "gcp":
    case "googlecloud":
      return <SiGooglecloud className={cn("text-[#4285F4] shrink-0", className)} />;
    case "postman":
      return <SiPostman className={cn("text-[#FF6C37] shrink-0", className)} />;
  }

  // 3. Fallback: Dynamic SimpleIcons / Devicons CDN for any other tool/technology
  if (!imgFailed && key.length > 1) {
    const slug = key === "csharp" ? "csharp" : key;
    return (
      <img
        src={`https://cdn.simpleicons.org/${slug}`}
        alt=""
        loading="lazy"
        className={cn("shrink-0 object-contain rounded-[2px]", className)}
        onError={() => setImgFailed(true)}
      />
    );
  }

  // 4. Default fallback: Clean tech icon
  return <Code2 className={cn("text-accent shrink-0", className)} />;
}
