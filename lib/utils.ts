import { Adresse } from '@/types';

/**
 * Formate une adresse en chaîne de caractères complète
 */
export function formaterAdresse(adresse: Adresse): string {
  const parties: string[] = [];
  
  if (adresse.ligne) parties.push(adresse.ligne);
  if (adresse.rue) parties.push(adresse.rue);
  if (adresse.complement) parties.push(adresse.complement);
  if (adresse.code_postal) parties.push(adresse.code_postal);
  if (adresse.ville) parties.push(adresse.ville);
  
  return parties.join(', ');
}

/**
 * Stocke les contacts dans le localStorage
 */
export function sauvegarderContacts(contacts: any[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('contacts', JSON.stringify(contacts));
  }
}

/**
 * Charge les contacts depuis le localStorage
 */
export function chargerContacts(): any[] {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('contacts');
    if (stored) {
      return JSON.parse(stored);
    }
  }
  return [];
}
