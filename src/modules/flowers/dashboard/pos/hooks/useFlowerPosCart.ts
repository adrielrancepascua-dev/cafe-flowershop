import { useMemo, useState } from 'react';
import type { FlowerPosCatalogItem } from '../../../shared/data/flowers.mock';

export interface FlowerPosCartItem {
  productId: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
}

export function useFlowerPosCart() {
  const [cart, setCart] = useState<FlowerPosCartItem[]>([]);

  function addToCart(product: FlowerPosCatalogItem) {
    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (existing) {
        return current.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }

      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          category: product.category,
          price: product.base_price,
          quantity: 1,
        },
      ];
    });
  }

  function incrementItem(productId: string) {
    setCart((current) =>
      current.map((item) =>
        item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item,
      ),
    );
  }

  function decrementItem(productId: string) {
    setCart((current) =>
      current
        .map((item) =>
          item.productId === productId
            ? { ...item, quantity: Math.max(0, item.quantity - 1) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function clearOrder() {
    setCart([]);
  }

  const itemCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart],
  );

  const total = subtotal;

  return {
    cart,
    addToCart,
    incrementItem,
    decrementItem,
    clearOrder,
    itemCount,
    subtotal,
    total,
  };
}
