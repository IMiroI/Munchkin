export enum CardType {
  Monster = 'Monster',
  Treasure = 'Treasure',
  DoorCurse = 'DoorCurse',
  Class = 'Class',
  Race = 'Race',
}

export interface Card {
  id: string;
  name: string;
  type: CardType;
  power?: number;
  effect?: string;
}
