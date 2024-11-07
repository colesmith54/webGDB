// src/components/CodeEditor.tsx

import {
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
    `#include <iostream>
#include <vector>
#include <list>
#include <deque>
#include <array>
#include <forward_list>
#include <set>
#include <map>
#include <unordered_set>
#include <unordered_map>
#include <stack>
#include <queue>
#include <string>
#include <utility>
#include <tuple>

int main() {

    int i = -5;

    int a[4];
    a[0] = 0;
    a[1] = 1;
    a[2] = 2;
    a[3] = 3;

    double d = 6.1384612;

    char c = 'e';
    
    std::string str = "hello word";

    std::vector<int> vec = {1, 2, 3, 4, 5};

    std::list<std::string> lst = {"hello", "world", "from", "GDB-MI"};

    std::deque<double> deq = {1.1, 2.2, 3.3, 4.4};

    std::array<int, 5> arr = {10, 20, 30, 40, 50};

    std::forward_list<char> fwd_lst = {'a', 'b', 'c', 'd'};

    std::set<int> s = {5, 3, 1, 4, 2};

    std::multiset<int> ms = {1, 2, 2, 3, 4, 4, 5};

    std::map<std::string, int> m = {
        {"one", 1},
        {"two", 2},
        {"three", 3}
    };

    std::multimap<std::string, int> mm = {
        {"one", 1},
        {"one", 11},
        {"two", 2},
        {"three", 3},
        {"three", 33}
    };

    std::unordered_set<int> us = {10, 20, 30, 40, 50};

    std::unordered_multiset<int> ums = {100, 200, 200, 300, 400, 400, 500};

    std::unordered_map<std::string, int> um = {
        {"alpha", 100},
        {"beta", 200},
        {"gamma", 300}
    };

    std::unordered_multimap<std::string, int> umm = {
        {"alpha", 100},
        {"alpha", 110},
        {"beta", 200},
        {"gamma", 300},
        {"gamma", 330}
    };

    std::stack<int> stk;
    stk.push(1);
    stk.push(2);
    stk.push(3);

    std::queue<int> que;
    que.push(10);
    que.push(20);
    que.push(30);

    std::priority_queue<int> pq;
    pq.push(5);
    pq.push(1);
    pq.push(3);
    pq.push(4);
    pq.push(2);

    std::pair<int, std::string> p = {42, "The answer"};

    std::tuple<int, double, std::string> t = {7, 3.14, "Pi"};

    std::cin.get();

    return 0;
}`
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
