interface Props {
  headers: string[];
  data: any[];
}

export default function Table({ headers, data }: Props) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl overflow-hidden">
      <table className="w-full text-sm text-left text-gray-200">
        
        {/* HEADER */}
        <thead className="bg-gray-700 text-gray-300 uppercase text-xs tracking-wider">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-6 py-4 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>

        {/* BODY */}
        <tbody className="divide-y divide-gray-700">
          {data.map((row, index) => (
            <tr
              key={index}
              className="hover:bg-gray-700/60 transition duration-200"
            >
              {Object.values(row).map((value, i) => (
                <td key={i} className="px-6 py-4">
                  {value as string}
                </td>
              ))}
            </tr>
          ))}
        </tbody>

      </table>
    </div>
  );
}
