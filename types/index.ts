export interface Adresse {
  ligne?: string;
  rue?: string;
  complement?: string;
  code_postal?: string;
  ville: string;
}

export interface Contact {
  nom: string;
  prenom?: string;
  adresse: Adresse;
  telephone_parents?: string;
}

export interface Etablissement {
  nom: string;
  adresse: Adresse;
}

export interface DonneesInitiales {
  contacts: Contact[];
  etablissement: Etablissement;
}

export interface Trajet {
  heureDepart: string;
  heureArrivee: string;
  pointDepart: string;
  pointArrivee: string;
  contacts?: Contact[];
}

export interface AdresseAutocomplete {
  label: string;
  value: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface PointTrajet {
  label: string;
  adresse: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  contact?: Contact;
  index: number;
}

export interface TrajetOptimise {
  points: PointTrajet[];
  distance: number; // en mètres
  duree: number; // en secondes
  heureDepart: string;
  heureArrivee: string;
}
