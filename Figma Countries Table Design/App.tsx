import { CountriesTable } from './components/countries-table';

export default function App() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <CountriesTable />
      </div>
    </div>
  );
}