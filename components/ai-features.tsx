import React, { useState } from 'react';
import { Bot, Sparkles, Search, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface Country {
  id: string;
  name_en: string;
  name_ka: string;
  iso2: string;
  iso3: string;
  un_code: number | null;
  country: string;
  is_active: boolean;
}

interface AIFeaturesProps {
  countries: Country[];
  onAddCountries: (countries: Omit<Country, 'id'>[]) => void;
  onUpdateCountry: (id: string, updates: Partial<Country>) => void;
}

// AI API helper
const callAI = async (endpoint: string, data: any) => {
  const response = await fetch(`https://${projectId}.supabase.co/functions/v1${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${publicAnonKey}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
};

// Auto-complete component
export const CountryAutoComplete: React.FC<{
  onComplete: (country: Omit<Country, 'id'>) => void;
}> = ({ onComplete }) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleComplete = async () => {
    if (!input.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await callAI('/make-server-b17cb9fd/ai/complete-country', {
        partial_name: input
      });

      if (response.success) {
        setResult(response.data);
      } else {
        setError(response.error || 'Failed to complete country information');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    if (result) {
      const { confidence, ...countryData } = result;
      onComplete(countryData);
      setInput('');
      setResult(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Enter country name (e.g., 'Japan', 'Fra', 'United')"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleComplete()}
        />
        <Button onClick={handleComplete} disabled={loading || !input.trim()}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
          Complete
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">AI Suggestion</h4>
            <Badge variant={result.confidence > 0.8 ? 'default' : 'secondary'}>
              {Math.round(result.confidence * 100)}% confident
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><strong>Name (EN):</strong> {result.name_en}</div>
            <div><strong>Name (KA):</strong> {result.name_ka || 'N/A'}</div>
            <div><strong>ISO2:</strong> {result.iso2}</div>
            <div><strong>ISO3:</strong> {result.iso3}</div>
            <div><strong>UN Code:</strong> {result.un_code || 'N/A'}</div>
            <div><strong>Country:</strong> {result.country}</div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleAccept}>
              <CheckCircle className="w-4 h-4 mr-1" />
              Accept & Add
            </Button>
            <Button size="sm" variant="outline" onClick={() => setResult(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// Smart search component
export const SmartSearch: React.FC<{
  countries: Country[];
  onSearchResults: (ids: string[]) => void;
}> = ({ countries, onSearchResults }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!query.trim()) {
      onSearchResults([]);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await callAI('/make-server-b17cb9fd/ai/smart-search', {
        query,
        countries: countries.map(c => ({ id: c.id, name_en: c.name_en, name_ka: c.name_ka, iso2: c.iso2, iso3: c.iso3, country: c.country }))
      });

      if (response.success) {
        onSearchResults(response.data.matched_ids);
      } else {
        setError(response.error || 'Search failed');
        onSearchResults([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search error');
      onSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder="Smart search: 'European countries', 'islands in Pacific', 'former Soviet', etc."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={loading} variant="outline">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>
      
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

// Country generator component
export const CountryGenerator: React.FC<{
  onGenerate: (countries: Omit<Country, 'id'>[]) => void;
}> = ({ onGenerate }) => {
  const [description, setDescription] = useState('');
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await callAI('/make-server-b17cb9fd/ai/generate-countries', {
        description,
        count
      });

      if (response.success) {
        onGenerate(response.data.countries);
        setIsOpen(false);
        setDescription('');
      } else {
        setError(response.error || 'Generation failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Sparkles className="w-4 h-4 mr-2" />
          Generate Countries
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>AI Country Generator</DialogTitle>
          <DialogDescription>
            Describe the type of countries you want to add, and AI will generate them for you.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="e.g., 'European Union countries', 'Small island nations', 'African countries'"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="count">Number of countries</Label>
            <Input
              id="count"
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value) || 5)}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={loading || !description.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Translation helper
export const GeorgianTranslator: React.FC<{
  countries: Country[];
  onTranslate: (translations: Record<string, string>) => void;
}> = ({ countries, onTranslate }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const missingTranslations = countries.filter(c => !c.name_ka || c.name_ka.trim() === '');

  const handleTranslate = async () => {
    if (missingTranslations.length === 0) return;

    setLoading(true);
    setError('');

    try {
      const countryNames = missingTranslations.map(c => c.name_en);
      
      const response = await callAI('/make-server-b17cb9fd/ai/translate-georgian', {
        country_names: countryNames
      });

      if (response.success) {
        onTranslate(response.data.translations);
      } else {
        setError(response.error || 'Translation failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Translation error');
    } finally {
      setLoading(false);
    }
  };

  if (missingTranslations.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <Button onClick={handleTranslate} disabled={loading} variant="outline" size="sm">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
        Translate {missingTranslations.length} to Georgian
      </Button>
      
      {error && (
        <Badge variant="destructive">{error}</Badge>
      )}
    </div>
  );
};

export const AIFeatures: React.FC<AIFeaturesProps> = ({ countries, onAddCountries, onUpdateCountry }) => {
  const handleAutoComplete = (country: Omit<Country, 'id'>) => {
    onAddCountries([country]);
  };

  const handleGenerate = (newCountries: Omit<Country, 'id'>[]) => {
    onAddCountries(newCountries);
  };

  const handleTranslations = (translations: Record<string, string>) => {
    countries.forEach(country => {
      if (translations[country.name_en] && (!country.name_ka || country.name_ka.trim() === '')) {
        onUpdateCountry(country.id, { name_ka: translations[country.name_en] });
      }
    });
  };

  return {
    CountryAutoComplete: () => <CountryAutoComplete onComplete={handleAutoComplete} />,
    SmartSearch: (props: { onSearchResults: (ids: string[]) => void }) => 
      <SmartSearch countries={countries} onSearchResults={props.onSearchResults} />,
    CountryGenerator: () => <CountryGenerator onGenerate={handleGenerate} />,
    GeorgianTranslator: () => <GeorgianTranslator countries={countries} onTranslate={handleTranslations} />
  };
};