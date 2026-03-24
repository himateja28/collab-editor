export const editorModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline"],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ align: [] }],
    ["link", "image"],
    ["clean"],
  ],
  history: {
    delay: 500,
    maxStack: 200,
    userOnly: true,
  },
};

export const editorFormats = [
  "header",
  "bold",
  "italic",
  "underline",
  "list",
  "bullet",
  "align",
  "link",
  "image",
];
