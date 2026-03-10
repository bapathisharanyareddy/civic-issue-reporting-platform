import java.util.*;
class Bstuff
{
	public static void main(String args[])
	{
		int i,n,k,j,s=0;
		int a[]=new int[10];
		int b[]=new int[20];
		int c[]=new int[10];
		Scanner x=new Scanner(System.in);
		System.out.println("enter the no.of elements");
		n=x.nextInt();
		System.out.println("enter the message");
		for(i=0;i<n;i++)
		    a[i]=x.nextInt();
		k=j=0;
		for(i=0;i<n;i++)
		{
			if(a[i]==1)
				k++;
			else
				k=0;
			b[j]=a[i];
			if(k==5)
			{
				b[++j]=0;
				k=0;
			}
			j++;
		}
		System.out.println("at transmission medium");
		for(k=0;k<j;k++)
		{
			System.out.println(b[k]);
		}
		k=0;
		for(i=0;i<j;i++)
		{
			if(b[i]==1)
				k++;
			else
				k=0;
			c[s]=b[i];
			if(k==5)
			{
				i++;
				k=0;
			}
			s++;
		}
		System.out.println("at transmission medium");
		for(k=0;k<s;k++)
		{
			System.out.println(c[k]);
		}
	}
}