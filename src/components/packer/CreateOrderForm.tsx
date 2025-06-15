
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { TablesInsert } from "@/integrations/supabase/types";

const formSchema = z.object({
  order_number: z.string().min(1, { message: "Order number cannot be empty." }),
});

type CreateOrderFormProps = {
  onOrderCreated: () => void;
};

const CreateOrderForm = ({ onOrderCreated }: CreateOrderFormProps) => {
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      order_number: "",
    },
  });

  const { mutate: createOrder, isPending } = useMutation<void, Error, z.infer<typeof formSchema>>({
    mutationFn: async (newOrder) => {
      const { error } = await supabase.from("orders").insert(newOrder);
      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      toast.success("Order created successfully!");
      queryClient.invalidateQueries({ queryKey: ["pendingOrders"] });
      onOrderCreated();
    },
    onError: (error) => {
      toast.error(`Failed to create order: ${error.message}`);
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createOrder(values);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="order_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Order Number</FormLabel>
              <FormControl>
                <Input placeholder="e.g., 100-1234567-1234567" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating..." : "Create Order"}
        </Button>
      </form>
    </Form>
  );
};

export default CreateOrderForm;
