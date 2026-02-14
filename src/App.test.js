import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { CartProvider } from "./cartContext";
import { RegionProvider } from "./regionContext";

test("renders navbar brand", () => {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <RegionProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </RegionProvider>
    </MemoryRouter>
  );

  expect(screen.getByLabelText(/zubilo home/i)).toBeInTheDocument();
});
