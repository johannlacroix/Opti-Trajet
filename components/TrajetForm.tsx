'use client';

import { useState, useEffect } from 'react';
import { Contact, Etablissement, AdresseAutocomplete } from '@/types';
import { rechercherAdresses } from '@/lib/api-adresse';
import { formaterAdresse } from '@/lib/utils';

interface TrajetFormProps {
  contacts: Contact[];
  etablissement: Etablissement;
  onSubmit: (trajet: any) => void;
  onAddContact?: () => void;
}

type SensTrajet = 'institut-domiciles' | 'domiciles-institut';

export default function TrajetForm({ contacts, etablissement, onSubmit, onAddContact }: TrajetFormProps) {
  const [heureDepart, setHeureDepart] = useState('16:00');
  const [heureArrivee, setHeureArrivee] = useState('08:45');
  const [sensTrajet, setSensTrajet] = useState<SensTrajet>('domiciles-institut');
  const [contactsSelectionnes, setContactsSelectionnes] = useState<string[]>([]);
  const [pointDepart, setPointDepart] = useState('');
  const [pointArrivee, setPointArrivee] = useState('');
  
  const [departSuggestions, setDepartSuggestions] = useState<AdresseAutocomplete[]>([]);
  const [arriveeSuggestions, setArriveeSuggestions] = useState<AdresseAutocomplete[]>([]);
  const [modePointDepart, setModePointDepart] = useState<'contact' | 'nouvelle'>('contact');
  const [contactDepartSelectionne, setContactDepartSelectionne] = useState<string>('');
  const [optimiserPourEnfants, setOptimiserPourEnfants] = useState<boolean>(false);

  // Remplir automatiquement avec l'établissement selon le sens du trajet
  useEffect(() => {
    const adresseEtablissement = formaterAdresse(etablissement.adresse);
    if (sensTrajet === 'institut-domiciles') {
      setPointDepart(adresseEtablissement);
      // Pour "Institut → Domiciles", le point d'arrivée sera le dernier domicile après optimisation
      // On ne demande pas de point d'arrivée spécifique
      setPointArrivee('');
      // Heure de départ par défaut : 16h00
      setHeureDepart('16:00');
    } else {
      setPointDepart('');
      setPointArrivee(adresseEtablissement);
      // Heure d'arrivée par défaut : 8h45
      setHeureArrivee('08:45');
    }
  }, [etablissement, sensTrajet]);

  // Mettre à jour le point de départ quand on change de contact sélectionné (pour domiciles-institut)
  useEffect(() => {
    if (sensTrajet === 'domiciles-institut' && modePointDepart === 'contact' && contactDepartSelectionne) {
      const contact = contacts.find(c => c.nom === contactDepartSelectionne);
      if (contact) {
        setPointDepart(formaterAdresse(contact.adresse));
      }
    }
  }, [contactDepartSelectionne, modePointDepart, contacts, sensTrajet]);

  const handleDepartChange = async (value: string) => {
    setPointDepart(value);
    
    if (value.length >= 3) {
      const results = await rechercherAdresses(value);
      setDepartSuggestions(results);
    } else {
      setDepartSuggestions([]);
    }
  };

  const handleArriveeChange = async (value: string) => {
    setPointArrivee(value);
    
    if (value.length >= 3) {
      const results = await rechercherAdresses(value);
      setArriveeSuggestions(results);
    } else {
      setArriveeSuggestions([]);
    }
  };

  const handleSelectDepart = (suggestion: AdresseAutocomplete) => {
    setPointDepart(suggestion.label);
    setDepartSuggestions([]);
  };

  const handleSelectArrivee = (suggestion: AdresseAutocomplete) => {
    setPointArrivee(suggestion.label);
    setArriveeSuggestions([]);
  };

  const toggleContact = (nom: string) => {
    setContactsSelectionnes(prev => 
      prev.includes(nom) 
        ? prev.filter(n => n !== nom)
        : [...prev, nom]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pointDepart) {
      alert('Veuillez remplir le point de départ');
      return;
    }

    if (sensTrajet === 'domiciles-institut' && !pointArrivee) {
      alert('Veuillez remplir le point d\'arrivée');
      return;
    }

    if (contactsSelectionnes.length === 0) {
      alert('Veuillez sélectionner au moins un contact');
      return;
    }

    const contactsSelected = contacts.filter(c => contactsSelectionnes.includes(c.nom));

    // Pour "Institut → Domiciles", le point d'arrivée sera le dernier domicile après optimisation
    // On passe une chaîne vide et l'optimisation déterminera le dernier domicile
    const pointArriveeFinal = sensTrajet === 'institut-domiciles' 
      ? '' // Sera déterminé par l'optimisation
      : pointArrivee;

    onSubmit({
      heureDepart: sensTrajet === 'institut-domiciles' ? heureDepart : '',
      heureArrivee: sensTrajet === 'domiciles-institut' ? heureArrivee : '',
      pointDepart,
      pointArrivee: pointArriveeFinal,
      contactsSelectionnes: contactsSelected,
      sensTrajet,
      optimiserPourEnfants,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        Nouveau trajet
      </h2>

      {/* Sélection du sens du trajet */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setSensTrajet('domiciles-institut')}
            className={`py-3 px-6 font-medium border-b-2 transition-colors ${
              sensTrajet === 'domiciles-institut'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Domicile(s) → Institut
          </button>
          <button
            type="button"
            onClick={() => setSensTrajet('institut-domiciles')}
            className={`py-3 px-6 font-medium border-b-2 transition-colors ${
              sensTrajet === 'institut-domiciles'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Institut → Domicile(s)
          </button>
        </div>
      </div>

      {sensTrajet === 'domiciles-institut' ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Heure d'arrivée à l'institut *
          </label>
          <input
            type="time"
            value={heureArrivee}
            onChange={(e) => setHeureArrivee(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            L'heure de départ sera calculée en fonction de la durée du trajet
          </p>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Heure de départ de l'institut *
          </label>
          <input
            type="time"
            value={heureDepart}
            onChange={(e) => setHeureDepart(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            L'heure d'arrivée au dernier domicile sera calculée en fonction de la durée du trajet
          </p>
        </div>
      )}

      {/* Point de départ */}
      {sensTrajet === 'domiciles-institut' ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Point de départ (domicile du premier enfant) *
          </label>
          <div className="mb-2">
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="contact"
                  checked={modePointDepart === 'contact'}
                  onChange={(e) => setModePointDepart('contact')}
                  className="mr-2"
                />
                <span className="text-gray-700">Sélectionner un contact</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="nouvelle"
                  checked={modePointDepart === 'nouvelle'}
                  onChange={(e) => setModePointDepart('nouvelle')}
                  className="mr-2"
                />
                <span className="text-gray-700">Nouvelle adresse</span>
              </label>
            </div>
          </div>

          {modePointDepart === 'contact' ? (
            <div className="space-y-2">
              <select
                value={contactDepartSelectionne}
                onChange={(e) => setContactDepartSelectionne(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                required
              >
                <option value="">-- Sélectionner un contact --</option>
                {contacts.map((contact) => {
                  const nomComplet = contact.prenom ? `${contact.prenom} ${contact.nom}` : contact.nom;
                  return (
                    <option key={contact.nom} value={contact.nom}>
                      {nomComplet} - {formaterAdresse(contact.adresse)}
                    </option>
                  );
                })}
              </select>
              {contacts.length > 0 && onAddContact && (
                <button
                  type="button"
                  onClick={onAddContact}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  + Ajouter un nouveau contact
                </button>
              )}
              <input
                type="text"
                value={pointDepart}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
              />
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={pointDepart}
                onChange={(e) => handleDepartChange(e.target.value)}
                placeholder="Commencez à taper une adresse..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                required
              />
              {departSuggestions.length > 0 && (
                <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                  {departSuggestions.map((suggestion, index) => (
                    <li
                      key={index}
                      onClick={() => handleSelectDepart(suggestion)}
                      className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-900"
                    >
                      {suggestion.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Point de départ (Institut) *
          </label>
          <input
            type="text"
            value={pointDepart}
            onChange={(e) => handleDepartChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-gray-50"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            {etablissement.nom} - {formaterAdresse(etablissement.adresse)}
          </p>
        </div>
      )}

      {/* Point d'arrivée */}
      {sensTrajet === 'domiciles-institut' ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Point d'arrivée (Institut) *
          </label>
          <input
            type="text"
            value={pointArrivee}
            onChange={(e) => handleArriveeChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-gray-50"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            {etablissement.nom} - {formaterAdresse(etablissement.adresse)}
          </p>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Point d'arrivée (dernier domicile après optimisation)
          </label>
          <input
            type="text"
            value="Sera déterminé automatiquement après optimisation"
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed"
          />
          <p className="text-xs text-gray-500 mt-1">
            L'ordre des domiciles sera optimisé automatiquement
          </p>
        </div>
      )}

      {/* Option d'optimisation */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={optimiserPourEnfants}
            onChange={(e) => setOptimiserPourEnfants(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">
            Optimiser pour minimiser le temps de chaque enfant (au lieu de la durée totale)
          </span>
        </label>
        <p className="text-xs text-gray-500 mt-1 ml-6">
          {optimiserPourEnfants 
            ? 'Les enfants seront déposés/récupérés du plus proche au plus loin pour minimiser leur temps en voiture'
            : 'Optimisation classique pour minimiser la durée totale du trajet'
          }
        </p>
      </div>

      {/* Contacts à transporter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {sensTrajet === 'domiciles-institut' 
            ? 'Enfants à transporter vers l\'institut' 
            : 'Enfants à transporter vers leur domicile'}
        </label>
        <div className="border border-gray-300 rounded-md p-4 max-h-60 overflow-y-auto">
          {contacts.length === 0 ? (
            <p className="text-gray-600 text-sm">
              Aucun contact disponible.{' '}
              {onAddContact && (
                <button
                  type="button"
                  onClick={onAddContact}
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  Ajoutez-en d'abord dans le répertoire
                </button>
              )}
            </p>
          ) : (
            <div className="space-y-2">
              {contacts.map((contact) => {
                const isSelected = contactsSelectionnes.includes(contact.nom);
                const nomComplet = contact.prenom ? `${contact.prenom} ${contact.nom}` : contact.nom;
                
                return (
                  <label
                    key={contact.nom}
                    className={`flex items-center p-2 rounded cursor-pointer hover:bg-gray-50 ${
                      isSelected ? 'bg-blue-50 border-2 border-blue-500' : 'border-2 border-transparent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleContact(contact.nom)}
                      className="mr-3 w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{nomComplet}</div>
                      <div className="text-sm text-gray-700">{formaterAdresse(contact.adresse)}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
        disabled={contactsSelectionnes.length === 0}
      >
        Générer le trajet optimal
      </button>
    </form>
  );
}
