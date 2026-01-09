'use client';

import { Contact } from '@/types';
import { formaterAdresse } from '@/lib/utils';

interface ContactListProps {
  contacts: Contact[];
  onEdit: (contact: Contact) => void;
  onDelete: (nom: string) => void;
}

export default function ContactList({ contacts, onEdit, onDelete }: ContactListProps) {
  if (contacts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Aucun contact enregistré. Ajoutez-en un pour commencer.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {contacts.map((contact, index) => (
        <div
          key={index}
          className="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-800">
                {contact.prenom ? `${contact.prenom} ${contact.nom}` : contact.nom}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {formaterAdresse(contact.adresse)}
              </p>
              {contact.telephone_parents && (
                <p className="text-sm text-gray-500 mt-1">
                  📞 {contact.telephone_parents}
                </p>
              )}
            </div>
            <div className="flex gap-2 ml-4">
              <button
                onClick={() => onEdit(contact)}
                className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
              >
                Modifier
              </button>
              <button
                onClick={() => onDelete(contact.nom)}
                className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
