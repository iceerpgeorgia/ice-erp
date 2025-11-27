import EntityTypesTableFigma from './EntityTypesTableFigma';

export const metadata = {
  title: 'Entity Types',
  description: 'Manage entity type data',
};

export default function EntityTypesPage() {
  return (
    <div className="h-screen">
      <EntityTypesTableFigma />
    </div>
  );
}
