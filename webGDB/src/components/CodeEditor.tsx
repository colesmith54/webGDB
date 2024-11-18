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

// Custom hash function for std::pair<int, int>
struct pair_hash {
    template <class T1, class T2>
    std::size_t operator()(const std::pair<T1, T2>& p) const {
        return std::hash<T1>()(p.first) ^ (std::hash<T2>()(p.second) << 1);
    }
};

// Custom hash function for tuple<int, string, char>
struct TupleHash {
    std::size_t operator()(const std::tuple<int, std::string, char>& tpl) const {
        auto [a, b, c] = tpl;
        std::size_t h1 = std::hash<int>{}(a);
        std::size_t h2 = std::hash<std::string>{}(b);
        std::size_t h3 = std::hash<char>{}(c);
        
        // Combine hashes
        return h1 ^ (h2 << 1) ^ (h3 << 2);
    }
};

int main() {
    // Complex combinations with hash-compatible keys and use of pairs/tuples
    
    // 1. Unordered_map with std::pair<int, int> as key, value is a list of forward_lists of vectors of pairs (int, string)
    std::unordered_map<std::pair<int, int>, std::list<std::forward_list<std::vector<std::pair<int, std::string>>>>, pair_hash> complex_umap1;
    std::vector<std::pair<int, std::string>> vec1 = {{1, "one"}, {2, "two"}};
    std::forward_list<std::vector<std::pair<int, std::string>>> fwd_lst1 = {vec1};
    std::list<std::forward_list<std::vector<std::pair<int, std::string>>>> lst1 = {fwd_lst1};
    complex_umap1[std::make_pair(1, 2)] = lst1;

    // 2. Unordered_map with std::string as key, value is a deque of vectors of pairs (int, double)
    std::unordered_map<std::string, std::deque<std::vector<std::pair<int, double>>>> complex_umap2;
    std::vector<std::pair<int, double>> vec2 = {{1, 3.14}, {2, 2.71}};
    std::deque<std::vector<std::pair<int, double>>> deq1 = {vec2};
    complex_umap2["complex_key"] = deq1;

    // 3. Forward_list of unordered_map with std::pair<int, int> as key, value is a deque of arrays (int, 3)
    std::forward_list<std::unordered_map<std::pair<int, int>, std::deque<std::array<int, 3>>, pair_hash>> complex_fwd_lst1;
    std::array<int, 3> arr1 = {1, 2, 3};
    std::deque<std::array<int, 3>> deq2 = {arr1};
    std::unordered_map<std::pair<int, int>, std::deque<std::array<int, 3>>, pair_hash> umap1 = {{std::make_pair(1, 1), deq2}};
    complex_fwd_lst1.push_front(umap1);

    // 4. Map with std::string as key, value is a stack of lists of pairs (int, char)
    std::map<std::string, std::stack<std::list<std::pair<int, char>>>> complex_map1;
    std::pair<int, char> pair1 = {10, 'a'};
    std::list<std::pair<int, char>> lst3 = {pair1};
    std::stack<std::list<std::pair<int, char>>> stack1;
    stack1.push(lst3);
    complex_map1["stack_key"] = stack1;

    // 5. Unordered_map with int as key, value is a forward_list of vectors of tuples (int, double, std::string)
    std::unordered_map<int, std::forward_list<std::vector<std::tuple<int, double, std::string>>>> complex_umap3;
    std::tuple<int, double, std::string> tpl1 = {1, 3.14, "value"};
    std::vector<std::tuple<int, double, std::string>> vec3 = {tpl1};
    std::forward_list<std::vector<std::tuple<int, double, std::string>>> fwd_lst3 = {vec3};
    complex_umap3[42] = fwd_lst3;

    // 6. List of maps with int as key, value is a deque of pairs (std::string, int)
    std::list<std::map<int, std::deque<std::pair<std::string, int>>>> complex_list1;
    std::pair<std::string, int> pair2 = {"item", 100};
    std::deque<std::pair<std::string, int>> deq3 = {pair2};
    std::map<int, std::deque<std::pair<std::string, int>>> map1 = {{1, deq3}};
    complex_list1.push_back(map1);

    // 7. Array of unordered_maps with std::string as key, value is a priority_queue of vectors of ints
    std::array<std::unordered_map<std::string, std::priority_queue<std::vector<int>>>, 2> complex_array1;
    std::vector<int> vec4 = {10, 20, 30};
    std::priority_queue<std::vector<int>> pq1;
    pq1.push(vec4);
    std::unordered_map<std::string, std::priority_queue<std::vector<int>>> umap2 = {{"array_key", pq1}};
    complex_array1[0] = umap2;

    // 8. Stack of unordered_maps with std::pair<int, int> as key, value is a forward_list of sets of doubles
    std::stack<std::unordered_map<std::pair<int, int>, std::forward_list<std::set<double>>, pair_hash>> complex_stack1;
    std::set<double> set2 = {2.5, 3.5, 4.5};
    std::forward_list<std::set<double>> fwd_lst4 = {set2};
    std::unordered_map<std::pair<int, int>, std::forward_list<std::set<double>>, pair_hash> umap3 = {{std::make_pair(100, 200), fwd_lst4}};
    complex_stack1.push(umap3);

    // 9. Unordered_map with std::pair<int, std::string> as key, value is a deque of forward_lists of pairs (char, double)
    std::unordered_map<std::pair<int, std::string>, std::deque<std::forward_list<std::pair<char, double>>>, pair_hash> complex_umap4;
    std::pair<char, double> pair3 = {'x', 2.2};
    std::forward_list<std::pair<char, double>> fwd_lst5 = {pair3};
    std::deque<std::forward_list<std::pair<char, double>>> deq4 = {fwd_lst5};
    complex_umap4[std::make_pair(1, "key")] = deq4;

    // 10. Map with int as key, value is a list of unordered_sets of tuples (int, std::string, char)
    std::map<int, std::list<std::unordered_set<std::tuple<int, std::string, char>, TupleHash>>> complex_map2;
    std::tuple<int, std::string, char> tpl2 = {1, "alpha", 'A'};
    std::unordered_set<std::tuple<int, std::string, char>, TupleHash> us1 = {tpl2};
    std::list<std::unordered_set<std::tuple<int, std::string, char>, TupleHash>> lst4 = {us1};
    complex_map2[100] = lst4;

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
