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
  const [trajetsOptimises, setTrajetsOptimises] = useState<Array<{ id: number; trajet: TrajetOptimise; routeGeometry?: Coordinates[]; parametres: any; nombreSegments?: number }>>([]);
  const [activeTrajetIndex, setActiveTrajetIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [derniersParametres, setDerniersParametres] = useState<any>(null);

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

    try {
      // Générer toutes les variantes possibles automatiquement
      const variantes = [
        { ...trajetData, optimiserPourEnfants: false }, // Durée totale minimisée
        { ...trajetData, optimiserPourEnfants: true },  // Temps de chaque enfant minimisé
      ];

      const trajetsGeneres: Array<{ id: number; trajet: TrajetOptimise; routeGeometry?: Coordinates[]; parametres: any; nombreSegments?: number }> = [];

      // Générer chaque variante
      for (const parametresVariante of variantes) {
        try {
          const result = await optimiserTrajet(parametresVariante, etablissement);
          if (result) {
            trajetsGeneres.push({
              id: Date.now() + Math.random(), // ID unique
              trajet: result.trajet,
              routeGeometry: result.routeGeometry,
              parametres: parametresVariante,
              nombreSegments: result.nombreSegments || 0,
            });
          }
        } catch (error) {
          console.error('Erreur lors de la génération d\'une variante:', error);
          // Continuer avec les autres variantes même si une échoue
        }
      }

      if (trajetsGeneres.length === 0) {
        alert('Erreur lors de l\'optimisation des trajets. Veuillez vérifier les adresses.');
        return;
      }

      // Trier par durée (du plus rapide au plus lent), puis par distance (du plus court au plus long), 
      // puis par nombre de segments (du plus simple au plus complexe) en cas d'égalité
      trajetsGeneres.sort((a, b) => {
        // D'abord par durée
        const diffDuree = a.trajet.duree - b.trajet.duree;
        if (diffDuree !== 0) {
          return diffDuree;
        }
        // En cas d'égalité de durée, trier par distance (du plus court au plus long)
        const diffDistance = a.trajet.distance - b.trajet.distance;
        if (diffDistance !== 0) {
          return diffDistance;
        }
        // En cas d'égalité de durée et distance, trier par nombre de segments (du plus simple au plus complexe)
        // Moins de segments = moins de changements de direction = plus "facile"
        const nbSegmentsA = a.nombreSegments || 0;
        const nbSegmentsB = b.nombreSegments || 0;
        return nbSegmentsA - nbSegmentsB;
      });

      setDerniersParametres(trajetData);
      setTrajetsOptimises(trajetsGeneres);
      setActiveTrajetIndex(0); // Afficher le plus rapide par défaut
      setActiveTab('trajet');
    } catch (error) {
      console.error('Erreur:', error);
      const messageErreur = error instanceof Error ? error.message : 'Une erreur est survenue lors du calcul du trajet.';
      alert(messageErreur);
    } finally {
      setIsLoading(false);
    }
  };


  const handleSupprimerTrajet = (index: number) => {
    setTrajetsOptimises(prev => {
      if (prev.length <= 1) {
        setDerniersParametres(null);
        setActiveTrajetIndex(0);
        return [];
      } else {
        const nouveauxTrajets = prev.filter((_, i) => i !== index);
        if (activeTrajetIndex >= nouveauxTrajets.length) {
          setActiveTrajetIndex(nouveauxTrajets.length - 1);
        }
        return nouveauxTrajets;
      }
    });
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
            {trajetsOptimises.length > 0 ? (
              <>
                {/* Onglets des trajets */}
                <div className="bg-white rounded-lg shadow-md">
                  <div className="border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2 overflow-x-auto">
                        {trajetsOptimises.map((trajet, index) => {
                          const nomsVariantes = ['Premier', 'Bis', 'Ter', 'Quater', 'Quinquies', 'Sexies'];
                          const nomVariante = nomsVariantes[index] || `${index + 1}`;
                          
                          return (
                            <div key={trajet.id} className="flex items-center">
                              <button
                                onClick={() => setActiveTrajetIndex(index)}
                                className={`py-3 px-6 font-medium border-b-2 transition-colors whitespace-nowrap ${
                                  activeTrajetIndex === index
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-600 hover:text-gray-800'
                                }`}
                              >
                                Trajet {nomVariante}
                              </button>
                              {trajetsOptimises.length > 1 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSupprimerTrajet(index);
                                  }}
                                  className="ml-2 text-red-500 hover:text-red-700 px-2 py-1"
                                  title="Supprimer ce trajet"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex gap-2 px-4">
                        <button
                          onClick={() => {
                            setTrajetsOptimises([]);
                            setActiveTrajetIndex(0);
                            setDerniersParametres(null);
                          }}
                          className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
                        >
                          Nouveau trajet
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Affichage du trajet actif */}
                {trajetsOptimises[activeTrajetIndex] && (
                  <TrajetOptimiseView 
                    trajet={trajetsOptimises[activeTrajetIndex].trajet}
                    routeGeometry={trajetsOptimises[activeTrajetIndex].routeGeometry}
                  />
                )}
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
