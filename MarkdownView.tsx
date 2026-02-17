import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

export default function MarkdownView(props: {
  markdown: string;
  components: Parameters<typeof ReactMarkdown>[0]["components"];
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={props.components}
    >
      {props.markdown}
    </ReactMarkdown>
  );
}
