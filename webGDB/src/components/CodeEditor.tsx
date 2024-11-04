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

interface CodeEditorProps {
  handleSetBreakpoint: (line: number) => void;
  handleRemoveBreakpoint: (line: number) => void;
  currentLine?: number | null;
  isReadOnly?: boolean;
}

const CodeEditor = forwardRef((props: CodeEditorProps, ref) => {
  const {
    handleSetBreakpoint,
    handleRemoveBreakpoint,
    currentLine,
    isReadOnly,
  } = props;
  const [code, setCode] = useState<string>(
    `#include <iostream>\n#include <vector>\nusing namespace std;\n\nint main() {\n    int n = 4;\n    vector<int> x(4, 0);\n    cout << "before breakpoint" << endl;\n    cout << endl;\n    cout << "after breakpoint" << endl;\n    return 0;\n}`
  );
  const [breakpoints, setBreakpoints] = useState<number[]>([]);
  const [decorationIds, setDecorationIds] = useState<string[]>([]);
  const [currentLineDecorationId, setCurrentLineDecorationId] = useState<
    string | null
  >(null);
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
        handleRemoveBreakpoint(lineNumber);
        return prevBreakpoints.filter((ln) => ln !== lineNumber);
      } else {
        handleSetBreakpoint(lineNumber);
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

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({ readOnly: isReadOnly });
    }
  }, [isReadOnly]);

  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      if (currentLineDecorationId) {
        editorRef.current.deltaDecorations([currentLineDecorationId], []);
        setCurrentLineDecorationId(null);
      }

      if (currentLine !== undefined && currentLine !== null) {
        const newDecoration = {
          range: new monacoRef.current.Range(currentLine, 1, currentLine, 1),
          options: {
            isWholeLine: true,
            className: "current-break-line",
          },
        };

        const [newId] = editorRef.current.deltaDecorations([], [newDecoration]);
        setCurrentLineDecorationId(newId);

        editorRef.current.revealLineInCenter(currentLine);
      }
    }
  }, [currentLine]);

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
      className="code-editor"
    />
  );
});

export default CodeEditor;
