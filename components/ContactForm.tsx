'use client';

import { useState } from 'react';
import { Contact, AdresseAutocomplete } from '@/types';
import { rechercherAdresses } from '@/lib/api-adresse';
import { formaterAdresse } from '@/lib/utils';

interface ContactFormProps {
  contact?: Contact;
  onSave: (contact: Contact) => void;
  onCancel: () => void;
}

export default function ContactForm({ contact, onSave, onCancel }: ContactFormProps) {
  const [nom, setNom] = useState(contact?.nom || '');
  const [prenom, setPrenom] = useState(contact?.prenom || '');
  const [telephone, setTelephone] = useState(contact?.telephone_parents || '');
  const [adresseRecherche, setAdresseRecherche] = useState('');
  const [suggestions, setSuggestions] = useState<AdresseAutocomplete[]>([]);
  const [adresseComplete, setAdresseComplete] = useState<AdresseAutocomplete | null>(null);

  const handleAdresseChange = async (value: string) => {
    setAdresseRecherche(value);
    
    if (value.length >= 3) {
      const results = await rechercherAdresses(value);
      setSuggestions(results);
    } else {
      setSuggestions([]);
    }
  };

  const handleSelectAdresse = (suggestion: AdresseAutocomplete) => {
    setAdresseComplete(suggestion);
    setAdresseRecherche(suggestion.label);
    setSuggestions([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nom || !adresseComplete) {
      alert('Veuillez remplir le nom et l\'adresse');
      return;
    }

    // Parser l'adresse depuis le label de l'API
    const adresseParts = adresseComplete.label.split(', ');
    const adresse: Contact['adresse'] = {
      rue: adresseParts[0] || '',
      code_postal: adresseParts[adresseParts.length - 2] || '',
      ville: adresseParts[adresseParts.length - 1] || '',
    };

    const nouveauContact: Contact = {
      nom,
      prenom: prenom || undefined,
      adresse,
      telephone_parents: telephone || undefined,
    };

    onSave(nouveauContact);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold text-gray-800 mb-4">
        {contact ? 'Modifier le contact' : 'Nouveau contact'}
      </h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nom *
        </label>
        <input
          type="text"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Prénom
        </label>
        <input
          type="text"
          value={prenom}
          onChange={(e) => setPrenom(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
        />
      </div>

      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Adresse *
        </label>
        <input
          type="text"
          value={adresseRecherche}
          onChange={(e) => handleAdresseChange(e.target.value)}
          placeholder="Commencez à taper une adresse..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          required
        />
        {suggestions.length > 0 && (
          <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
            {suggestions.map((suggestion, index) => (
              <li
                key={index}
                onClick={() => handleSelectAdresse(suggestion)}
                className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-900"
              >
                {suggestion.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Téléphone parents
        </label>
        <input
          type="tel"
          value={telephone}
          onChange={(e) => setTelephone(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
        />
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Enregistrer
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
