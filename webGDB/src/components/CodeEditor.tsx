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
    `#include <bits/stdc++.h>
using namespace std;

struct Node {
    int val;
    Node* left;
    Node* right;
    Node(int v) : val(v), left(nullptr), right(nullptr) {}
};

Node* insert(Node* root, int val) {
    if (!root) return new Node(val);
    if (val < root->val)
        root->left = insert(root->left, val);
    else
        root->right = insert(root->right, val);
    return root;
}

struct ListNode {
    int data;
    ListNode* next;
    ListNode(int d) : data(d), next(nullptr) {}
};

int main() {
    Node* root = nullptr;
    for (int v : {5, 3, 7, 1, 4, 6, 8})
        root = insert(root, v);

    ListNode* head = new ListNode(10);
    head->next = new ListNode(20);
    head->next->next = new ListNode(30);

    vector<int> nums = {1, 2, 3, 4, 5, 6, 7, 8, 9, 0};
    priority_queue<int> pq(nums.begin(), nums.end());
    
    int answer = 42; // <-- set breakpoint here
    return 0;
}
`
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

    const model = editor.getModel();
    if (model) {
      model.onDidChangeContent(() => {
        const maxLine = model.getLineCount();
        setBreakpoints((prev) => prev.filter((ln) => ln <= maxLine));
      });
    }
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
      const monacoInstance = monacoRef.current;
      const editorInstance = editorRef.current;

      editorInstance.deltaDecorations(decorationIds, []);

      const newDecorations = breakpoints.map((lineNumber) => ({
        range: new monacoInstance.Range(lineNumber, 1, lineNumber, 1),
        options: {
          isWholeLine: true,
          className: "breakpoint-line",
          glyphMarginClassName: "breakpoint-glyph",
          glyphMarginHoverMessage: { value: "Breakpoint" },
          stickiness:
            monacoInstance.editor.TrackedRangeStickiness
              .NeverGrowsWhenTypingAtEdges,
        },
      }));

      const newDecorationIds = editorInstance.deltaDecorations(
        decorationIds,
        newDecorations
      );

      setDecorationIds(newDecorationIds);
    }
  }, [breakpoints, code]);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({ readOnly: isReadOnly });
    }
  }, [isReadOnly]);

  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      const editorInstance = editorRef.current;
      const monacoInstance = monacoRef.current;

      if (currentLineDecorationId) {
        editorInstance.deltaDecorations([currentLineDecorationId], []);
        setCurrentLineDecorationId(null);
      }

      if (currentLine !== undefined && currentLine !== null) {
        const newDecoration = {
          range: new monacoInstance.Range(currentLine, 1, currentLine, 1),
          options: {
            isWholeLine: true,
            className: "current-break-line",
            stickiness:
              monacoInstance.editor.TrackedRangeStickiness
                .NeverGrowsWhenTypingAtEdges,
          },
        };

        const [newId] = editorInstance.deltaDecorations([], [newDecoration]);
        setCurrentLineDecorationId(newId);

        editorInstance.revealLineInCenter(currentLine);
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
