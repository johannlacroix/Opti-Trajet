'use client';

import { useState, useEffect } from 'react';
import { Contact, Etablissement, TrajetOptimise } from '@/types';
import { sauvegarderContacts, chargerContacts } from '@/lib/utils';
import { optimiserTrajet } from '@/lib/trajet-optimiseur';
import ContactList from '@/components/ContactList';
import ContactForm from '@/components/ContactForm';
import TrajetForm from '@/components/TrajetForm';
import TrajetOptimiseView from '@/components/TrajetOptimise';
import { initialData } from '@/data/initial-data';
import { Coordinates } from '@/lib/geocoding';

export default function Home() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [etablissement] = useState<Etablissement>(initialData.etablissement);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | undefined>();
  const [activeTab, setActiveTab] = useState<'contacts' | 'trajet'>('contacts');
  const [trajetOptimise, setTrajetOptimise] = useState<{ trajet: TrajetOptimise; routeGeometry?: Coordinates[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Charger les contacts au démarrage
  useEffect(() => {
    const stored = chargerContacts();
    if (stored.length > 0) {
      setContacts(stored);
    } else {
      // Première utilisation : charger les données initiales
      setContacts(initialData.contacts);
      sauvegarderContacts(initialData.contacts);
    }
  }, []);

  const handleSaveContact = (contact: Contact) => {
    let updatedContacts: Contact[];
    
    if (editingContact) {
      // Modifier un contact existant
      updatedContacts = contacts.map(c => 
        c.nom === editingContact.nom ? contact : c
      );
    } else {
      // Ajouter un nouveau contact
      updatedContacts = [...contacts, contact];
    }
    
    setContacts(updatedContacts);
    sauvegarderContacts(updatedContacts);
    setShowContactForm(false);
    setEditingContact(undefined);
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setShowContactForm(true);
  };

  const handleDeleteContact = (nom: string) => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer ${nom} ?`)) {
      const updatedContacts = contacts.filter(c => c.nom !== nom);
      setContacts(updatedContacts);
      sauvegarderContacts(updatedContacts);
    }
  };

  const handleTrajetSubmit = async (trajetData: any) => {
    setIsLoading(true);
    setTrajetOptimise(null);

    try {
      const result = await optimiserTrajet(trajetData, etablissement);
      
      if (result) {
        setTrajetOptimise(result);
        setActiveTab('trajet'); // Rester sur l'onglet trajet pour voir le résultat
      } else {
        alert('Erreur lors de l\'optimisation du trajet. Veuillez vérifier les adresses.');
      }
    } catch (error) {
      console.error('Erreur:', error);
      const messageErreur = error instanceof Error ? error.message : 'Une erreur est survenue lors du calcul du trajet.';
      alert(messageErreur);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-600 text-white shadow-md">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">Opti-Trajet</h1>
          <p className="text-blue-100 mt-1">Optimisation de trajets pour chauffeurs accompagnateurs</p>
        </div>
      </header>

      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex gap-4">
            <button
              onClick={() => {
                setActiveTab('contacts');
                setTrajetOptimise(null);
              }}
              className={`py-4 px-6 font-medium border-b-2 transition-colors ${
                activeTab === 'contacts'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Répertoire
            </button>
            <button
              onClick={() => {
                setActiveTab('trajet');
              }}
              className={`py-4 px-6 font-medium border-b-2 transition-colors ${
                activeTab === 'trajet'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Nouveau trajet
            </button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        {activeTab === 'contacts' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800">Répertoire des contacts</h2>
              <button
                onClick={() => {
                  setEditingContact(undefined);
                  setShowContactForm(true);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                + Ajouter un contact
              </button>
            </div>

            {showContactForm ? (
              <ContactForm
                contact={editingContact}
                onSave={handleSaveContact}
                onCancel={() => {
                  setShowContactForm(false);
                  setEditingContact(undefined);
                }}
              />
            ) : (
              <ContactList
                contacts={contacts}
                onEdit={handleEditContact}
                onDelete={handleDeleteContact}
              />
            )}
          </div>
        )}

        {activeTab === 'trajet' && (
          <div className="space-y-6">
            {trajetOptimise ? (
              <>
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-gray-800">Trajet optimisé</h2>
                  <button
                    onClick={() => setTrajetOptimise(null)}
                    className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
                  >
                    Nouveau trajet
                  </button>
                </div>
                <TrajetOptimiseView 
                  trajet={trajetOptimise.trajet}
                  routeGeometry={trajetOptimise.routeGeometry}
                />
              </>
            ) : (
              <>
                <div className="max-w-2xl mx-auto">
                  <TrajetForm
                    contacts={contacts}
                    etablissement={etablissement}
                    onSubmit={handleTrajetSubmit}
                    onAddContact={() => {
                      setActiveTab('contacts');
                      setEditingContact(undefined);
                      setShowContactForm(true);
                    }}
                  />
                </div>
                {isLoading && (
                  <div className="max-w-2xl mx-auto mt-6 bg-white p-6 rounded-lg shadow-md text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Calcul du trajet optimal en cours...</p>
                    <p className="text-sm text-gray-500 mt-2">Cela peut prendre quelques secondes</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
