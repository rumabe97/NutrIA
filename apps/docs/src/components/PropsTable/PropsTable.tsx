import { Table } from 'components/Table';

interface Row {
  default: string;
  description: string;
  prop: string;
  type: string;
}

export function PropsTable({ data }: { data: Row[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <th>Prop</th>
          <th>Type</th>
          <th>Default</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        {data.map(row => (
          <tr key={row.prop}>
            <td>
              <code>{row.prop}</code>
            </td>
            <td>
              <code>{row.type}</code>
            </td>
            <td>{row.default === '—' ? '—' : <code>{row.default}</code>}</td>
            <td>{row.description}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
