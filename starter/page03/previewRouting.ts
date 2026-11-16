import { cities, cityById, distanceKm, durationSeconds, type City } from '../../src/domain';
import type { MailPerson } from '../mailboxModel';
import type { Coordinate } from './mapData';
import { offsetCoordinate } from './nearbyPigeon';
import type { PreviewLetter } from './previewMail';

export function senderLocation(point: Coordinate, locationKnown: boolean): City {
  return { ...cityById('new-york'), name: locationKnown ? 'Your location' : 'New York', lat: point.latitude, lng: point.longitude };
}

export function previewRoute(person: MailPerson, origin: City, letters: PreviewLetter[], replyId?: string, treated = false) {
  // Captured mail retains the sender's coordinates, even after the map recenters.
  const reply = letters.find(letter => letter.id === replyId && letter.personId === person.id);
  // A repeatable cross-border route for the demo, independent of device location.
  const demoRoute = person.id === 'sammy' && !reply;
  if (demoRoute) origin = cityById('san-francisco');
  const contact = letters.find(letter => letter.personId === person.id && letter.replyDestination);
  const nearby = offsetCoordinate({ latitude: origin.lat, longitude: origin.lng }, 2.1, 25);
  const destination = reply?.replyDestination ?? contact?.replyDestination ?? (person.id === 'nearby'
    ? { ...origin, name: 'Nearby', lat: nearby.latitude, lng: nearby.longitude }
    : cities.find(city => city.name === person.city) ?? cityById('new-york'));
  const distance = distanceKm(origin, destination);
  const seconds = Math.ceil(durationSeconds(distance, false, 'cruise') * (treated ? 0.9 : 1));
  const minutes = Math.ceil(seconds / 60);
  const estimate = minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`;
  return { origin, destination, distanceKm: distance, durationMs: seconds * 1000, estimate, demoRoute, treated };
}
