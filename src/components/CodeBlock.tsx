import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vs } from "react-syntax-highlighter/dist/esm/styles/prism";

export const CodeBlock = ({
  className,
  children,
}: {
  className: string;
  children: string;
}) => {
  let lang = "text";
  if (className && className.startsWith("lang-")) {
    lang = className.replace("lang-", "");
  }
  return (
    <SyntaxHighlighter language={lang} style={vs} wrapLongLines>
      {children}
    </SyntaxHighlighter>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PreBlock = ({ children, ...rest }: { children: any }) => {
  if ("type" in children && children.type === "code") {
    return CodeBlock({
      className: children.props.className,
      children: children.props.children,
    });
  }
  return <pre {...rest}>{children}</pre>;
};
