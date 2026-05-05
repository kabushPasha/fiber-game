import { Form, InputGroup } from "react-bootstrap";

type Props = {
  palette: string[];
  onChange: (next: string[]) => void;
};

export function PaletteEditor({ palette, onChange }: Props) {

  const updateColor = (i: number, value: string) => {
    const next = [...palette];
    next[i] = value;
    onChange(next);
  };

  const addColor = () => {
    onChange([...palette, "#ff0000"]);
  };

  const deleteColor = (i: number) => {
    onChange(palette.filter((_, idx) => idx !== i));
  };

  const duplicateColor = (i: number) => {
    const next = [...palette];
    next.splice(i + 1, 0, palette[i]);
    onChange(next);
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        flexWrap: "wrap",
      }}
    >
      {palette.map((color, i) => (
        <InputGroup
          key={i}
          style={{ width: "auto", flex: "0 0 auto" }}
        >
          <Form.Control
            type="color"
            value={color}
            onChange={(e) => updateColor(i, e.target.value)}
            style={{ width: 40, height: 30, padding: 2 }}

            onClick={(e) => {
              if (e.ctrlKey) {
                e.preventDefault();
                duplicateColor(i);
              }
            }}

            onContextMenu={(e) => {
              e.preventDefault();
              deleteColor(i);
            }}
          />
        </InputGroup>
      ))}

      <button
        className="btn btn-primary btn-sm"
        onClick={addColor}
        style={{ flex: "0 0 auto" }}
      >
        ➕
      </button>
    </div>
  );
}
