import defaultMdxComponents from "fumadocs-ui/mdx";
import { Steps, Step } from "fumadocs-ui/components/steps";
import { Tabs, Tab } from "fumadocs-ui/components/tabs";
import type { MDXComponents } from "mdx/types.js";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Steps,
    Step,
    Tabs,
    Tab,
    ...components,
  };
}

export const useMDXComponents = getMDXComponents;

