// src/components/CodeEditor.tsx

import React, {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import Editor, { Monaco, OnMount } from "@monaco-editor/react";
import * as monacoEditor from "monaco-editor";

const CodeEditor = forwardRef((props, ref) => {
  const [code, setCode] = useState<string>(
    `#include <iostream>\n\nint main() {\n    // Write your code here\n    return 0;\n}`
  );
  const [breakpoints, setBreakpoints] = useState<number[]>([]);
  const [decorationIds, setDecorationIds] = useState<string[]>([]);
  const editorRef = useRef<monacoEditor.editor.IStandaloneCodeEditor | null>(
    null
  );
  const monacoRef = useRef<Monaco | null>(null);

  useImperativeHandle(ref, () => ({
    getCode: () => code,
    getBreakpoints: () => breakpoints,
  }));

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    editor.onMouseDown((event) => {
      if (
        event.target.type ===
          monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
        event.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS
      ) {
        const lineNumber = event.target.position?.lineNumber;
        if (lineNumber) {
          toggleBreakpoint(lineNumber);
        }
      }
    });
  };

  const toggleBreakpoint = (lineNumber: number) => {
    setBreakpoints((prevBreakpoints) => {
      if (prevBreakpoints.includes(lineNumber)) {
        return prevBreakpoints.filter((ln) => ln !== lineNumber);
      } else {
        return [...prevBreakpoints, lineNumber];
      }
    });
  };

  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      const newDecorations = breakpoints.map((lineNumber) => ({
        range: new monacoRef.current!.Range(lineNumber, 1, lineNumber, 1),
        options: {
          isWholeLine: true,
          className: "breakpoint-line",
          glyphMarginClassName: "breakpoint-glyph",
          glyphMarginHoverMessage: { value: "Breakpoint" },
        },
      }));

      const newDecorationIds = editorRef.current.deltaDecorations(
        decorationIds,
        newDecorations
      );

      setDecorationIds(newDecorationIds);
    }
  }, [breakpoints]);

  return (
    <Editor
      height="100%"
      defaultLanguage="cpp"
      value={code}
      theme="vs-dark"
      onChange={(value) => setCode(value || "")}
      onMount={handleEditorDidMount}
      options={{
        fontSize: 14,
        minimap: { enabled: false },
        wordWrap: "on",
        glyphMargin: true,
        lineNumbersMinChars: 3,
      }}
    />
  );
});

export default CodeEditor;
